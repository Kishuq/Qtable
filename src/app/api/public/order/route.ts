import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db, withDbRetry } from "@/lib/db";
import { requireCafe } from "@/lib/cafe";
import { subscriptionFromCafe, orderingBlockedReasonFor, planAllowsPro } from "@/lib/billing";
import { limitTenantRequest, tooMany, cleanStr, cleanPhone } from "@/lib/security";

const Item = z.object({ id: z.string().min(1).max(64), qty: z.number().int().min(1).max(20), note: z.string().max(120).optional().default("") });
const Schema = z.object({
  tableCode: z.string().min(1).max(12),
  slug: z.string().max(60).optional().default(""),
  customerName: z.string().max(60).optional().default("Guest"),
  customerPhone: z.string().max(15).optional().default(""),
  type: z.enum(["DINEIN", "TAKEAWAY"]).optional().default("DINEIN"),
  paymentMode: z.enum(["COUNTER", "UPI", "ONLINE"]).optional().default("COUNTER"),
  coupon: z.string().max(24).optional().default(""),
  note: z.string().max(240).optional().default(""),
  upiRef: z.string().max(30).optional().default(""),
  // One id per checkout attempt. A double-tap or a retried request (response
  // lost on a flaky connection) returns the SAME order instead of charging the
  // customer twice.
  clientToken: z.string().max(64).optional().default(""),
  items: z.array(Item).min(1).max(30),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid order", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // UPI model: one-tap "I've paid" fires the order instantly (zero friction).
  // Payment stays PENDING until the owner one-tap confirms the credit in their
  // UPI app (they're watching live orders anyway) — or Cashfree auto-confirms.
  // upiRef is optional metadata only, never a burden on the customer.
  const upiRef = cleanStr(d.upiRef, 30).replace(/[^a-zA-Z0-9]/g, "");

  let cafe;
  try { cafe = await withDbRetry(() => requireCafe(d.slug), "order-cafe"); } catch { return NextResponse.json({ error: "Outlet unavailable" }, { status: 404 }); }
  if (!cafe.isActive) return NextResponse.json({ error: "Outlet unavailable" }, { status: 404 });

  // 60/min per outlet, not per IP: a whole café shares one NAT address, and
  // neighbouring outlets on the same mall Wi-Fi must not eat each other's
  // budget. A 4× wider IP guard still caps a single abuser across all outlets.
  if (!(await limitTenantRequest(req, "order", cafe.slug, 60, 60_000))) return tooMany();

  // Paywall: unpaid (preview) outlets cannot take orders, and Basic (menu-only)
  // outlets cannot take orders either. Enforced here, not just in the UI.
  // The cafe row already carries the subscription columns, so this costs no
  // extra query — one fewer round trip on the hottest write path.
  const sub = subscriptionFromCafe(cafe);
  const blocked = orderingBlockedReasonFor(sub);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 402 });

  const table = await withDbRetry(
    () => db.cafeTable.findFirst({ where: { cafeId: cafe.id, code: d.tableCode, active: true } }),
    "order-table",
  );
  if (!table && d.type === "DINEIN") return NextResponse.json({ error: "Invalid table. Please re-scan the QR." }, { status: 400 });

  const clientToken = cleanStr(d.clientToken, 64) || null;
  if (clientToken) {
    const existing = await withDbRetry(
      () => db.order.findFirst({ where: { cafeId: cafe.id, clientToken }, include: { items: true } }),
      "order-idempotency",
    );
    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        order: {
          id: existing.id, tokenNo: existing.tokenNo, total: existing.total,
          status: existing.status, tableCode: existing.tableCode,
        },
      });
    }
  }

  // Validate items against live menu (price taken from server — never trust client)
  const ids = [...new Set(d.items.map((i) => i.id))];
  // Out-of-stock (tracked, count hit 0) items are unorderable — same as unavailable.
  const menu = await withDbRetry(
    () => db.menuItem.findMany({
      where: { id: { in: ids }, cafeId: cafe.id, available: true, OR: [{ stock: null }, { stock: { gt: 0 } }] },
    }),
    "order-menu",
  );
  if (menu.length !== ids.length) return NextResponse.json({ error: "Menu changed — some items unavailable. Refresh menu." }, { status: 409 });
  const priceOf = new Map(menu.map((m) => [m.id, m]));

  let subtotal = 0;
  const lines = d.items.map((i) => {
    const m = priceOf.get(i.id)!;
    subtotal += m.price * i.qty;
    return { menuItemId: m.id, name: m.name, price: m.price, qty: i.qty, note: cleanStr(i.note, 120) };
  });

  let discount = 0;
  const code = d.coupon.trim().toUpperCase();
  if (code) {
    const coupon = await withDbRetry(
      () => db.coupon.findFirst({ where: { cafeId: cafe.id, code, active: true } }),
      "order-coupon",
    );
    if (coupon) discount = Math.round((subtotal * coupon.pct) / 100);
  }
  const tax = Math.round(((subtotal - discount) * cafe.gstPct) / 100);
  const total = subtotal - discount + tax;

  // Rush-proof creation WITHOUT long interactive transactions:
  // each order is ONE atomic statement (order + items + payment nested).
  // Token numbers are day-scoped UNIQUE in the DB — on the rare same-millisecond
  // collision we simply retry. Single statements queue on the write lock and
  // drain in milliseconds, so 50 phones ordering at once all succeed instead of
  // timing out inside a 5-second transaction window.
  // Token series follows the cafe clock (IST), not server UTC.
  const { tokenDayIST } = await import("@/lib/day");
  const tokenDay = tokenDayIST();
  const baseData = {
    cafeId: cafe.id, tableId: table?.id, tableCode: d.type === "DINEIN" ? d.tableCode : "TAKEAWAY",
    tokenDay,
    clientToken,
    customerName: cleanStr(d.customerName, 60) || "Guest",
    customerPhone: cleanPhone(d.customerPhone),
    type: d.type, status: "NEW", paymentMode: d.paymentMode,
    paymentStatus: "PENDING", subtotal, discount, tax, total,
    note: cleanStr(d.note, 240),
    items: { create: lines },
    payments: { create: { cafeId: cafe.id, mode: d.paymentMode, status: "PENDING", amount: total, providerRef: d.paymentMode === "UPI" ? upiRef : "" } },
  };

  let order = null;
  let duplicate = false;
  try {
    // Generous attempts + tiny jitter: under an extreme same-millisecond burst
    // dozens of phones read the same max token and collide; each retry is two
    // millisecond queries, so even the unluckiest phone lands in ~1s.
    // The DB unique constraint is the source of truth — correctness never
    // depends on timing luck.
    for (let attempt = 0; attempt < 60 && !order; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 15)));
      const last = await withDbRetry(
        () => db.order.findFirst({
          where: { cafeId: cafe.id, tokenDay },
          orderBy: { tokenNo: "desc" },
          select: { tokenNo: true },
        }),
        "order-token",
      );
      try {
        order = await db.order.create({
          // Never wrap at 999: reusing a token within the same day collides with
          // the unique constraint forever. A monotonic series is the safe choice
          // for a café that genuinely serves >999 orders in a day.
          data: { ...baseData, tokenNo: (last?.tokenNo || 0) + 1 },
          include: { items: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
          // A concurrent double-tap won the clientToken race: return its order
          // instead of retrying forever (the token constraint can never clear).
          if (clientToken && target.includes("clientToken")) {
            const existing = await withDbRetry(
              () => db.order.findFirst({
                where: { cafeId: cafe.id, clientToken },
                select: { id: true, tokenNo: true, total: true, status: true, tableCode: true },
              }),
              "order-idempotency-race",
            );
            if (existing) {
              order = { ...existing, items: [] } as unknown as typeof order;
              duplicate = true;
              break;
            }
          }
          if (attempt < 59) continue; // token-number collision: retry
        }
        throw e;
      }
    }
    if (!order) throw new Error("TOKEN_RETRY_EXHAUSTED");
  } catch (e) {
    // Visible JSON (never an empty 500) + server log for ops.
    // Single-statement create is all-or-nothing: reaching here means NOTHING was
    // written, so the customer can safely retry with zero ghost-order risk.
    console.error("ORDER_CREATE_FAIL", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Kitchen is slammed right now — tap Place order once more." }, { status: 503 });
  }
  // A deduplicated retry has already been counted, stocked and audited.
  if (duplicate) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      order: { id: order.id, tokenNo: order.tokenNo, total: order.total, status: order.status, tableCode: order.tableCode },
    });
  }
  // Inventory (Pro only): decrement tracked stock per line. Guarded per-item
  // with gte so a same-millisecond rush can never drive counts negative.
  // Best-effort and parallel — a stock failure must never break a paid order,
  // and one slow update must not add serial latency to the checkout.
  try {
    if (planAllowsPro(sub.plan)) {
      await Promise.allSettled(
        lines.map((line) => {
          const m = priceOf.get(line.menuItemId);
          if (!m || m.stock === null || m.stock === undefined) return Promise.resolve();
          return db.menuItem.updateMany({
            where: { id: m.id, stock: { gte: line.qty } },
            data: { stock: { decrement: line.qty } },
          });
        }),
      );
    }
  } catch { /* stock must never break ordering */ }
  try {
    await db.auditLog.create({ data: { cafeId: cafe.id, action: "ORDER_CREATED", meta: `${order.id} ${order.tableCode} ${total} ${d.paymentMode}${upiRef ? ` ref=${upiRef}` : ""}` } });
  } catch { /* audit must never break ordering */ }

  return NextResponse.json({ ok: true, order: { id: order.id, tokenNo: order.tokenNo, total, status: order.status, tableCode: order.tableCode } });
}
