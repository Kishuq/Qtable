import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCafe } from "@/lib/cafe";
import { rateLimit, clientKey, tooMany, cleanStr, cleanPhone } from "@/lib/security";

const Item = z.object({ id: z.string().min(1).max(64), qty: z.number().int().min(1).max(20), note: z.string().max(120).optional().default("") });
const Schema = z.object({
  tableCode: z.string().min(1).max(12),
  customerName: z.string().max(60).optional().default("Guest"),
  customerPhone: z.string().max(15).optional().default(""),
  type: z.enum(["DINEIN", "TAKEAWAY"]).optional().default("DINEIN"),
  paymentMode: z.enum(["COUNTER", "UPI", "ONLINE"]).optional().default("COUNTER"),
  coupon: z.string().max(24).optional().default(""),
  note: z.string().max(240).optional().default(""),
  upiRef: z.string().max(30).optional().default(""),
  items: z.array(Item).min(1).max(30),
});

export async function POST(req: NextRequest) {
  // 60/min: a whole cafe shares one public IP (NAT), so per-IP budget must
  // cover every table at once. Abuse is still capped; proxies must forward XFF.
  if (!rateLimit(clientKey(req, "order"), 60, 60_000)) return tooMany();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid order", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // UPI model: one-tap "I've paid" fires the order instantly (zero friction).
  // Payment stays PENDING until the owner one-tap confirms the credit in their
  // UPI app (they're watching live orders anyway) — or Razorpay auto-confirms.
  // upiRef is optional metadata only, never a burden on the customer.
  const upiRef = cleanStr(d.upiRef, 30).replace(/[^a-zA-Z0-9]/g, "");

  let cafe;
  try { cafe = await requireCafe(); } catch { return NextResponse.json({ error: "Outlet unavailable" }, { status: 404 }); }
  if (!cafe.isActive) return NextResponse.json({ error: "Outlet unavailable" }, { status: 404 });

  // ✅ Strict subscription gate — no ordering while unpaid.
  try {
    const { getBilling, isBillingBlocked } = await import("@/lib/billing");
    if (isBillingBlocked(await getBilling())) {
      return NextResponse.json({ error: "This outlet's subscription is paused — please contact the counter." }, { status: 402 });
    }
  } catch {
    // billing check itself failed → fail open, continue to ordering
  }

  const table = await db.cafeTable.findFirst({ where: { cafeId: cafe.id, code: d.tableCode, active: true } });
  if (!table && d.type === "DINEIN") return NextResponse.json({ error: "Invalid table. Please re-scan the QR." }, { status: 400 });

  // Validate items against live menu (price taken from server — never trust client)
  const ids = [...new Set(d.items.map((i) => i.id))];
  const menu = await db.menuItem.findMany({ where: { id: { in: ids }, cafeId: cafe.id, available: true } });
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
    const coupon = await db.coupon.findFirst({ where: { cafeId: cafe.id, code, active: true } });
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
  const now = new Date();
  const tokenDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const baseData = {
    cafeId: cafe.id, tableId: table?.id, tableCode: d.type === "DINEIN" ? d.tableCode : "TAKEAWAY",
    tokenDay,
    customerName: cleanStr(d.customerName, 60) || "Guest",
    customerPhone: cleanPhone(d.customerPhone),
    type: d.type, status: "NEW", paymentMode: d.paymentMode,
    paymentStatus: "PENDING", subtotal, discount, tax, total,
    note: cleanStr(d.note, 240),
    items: { create: lines },
    payments: { create: { cafeId: cafe.id, mode: d.paymentMode, status: "PENDING", amount: total, providerRef: d.paymentMode === "UPI" ? upiRef : "" } },
  };

  let order = null;
  try {
    // Generous attempts + tiny jitter: under an extreme same-millisecond burst
    // dozens of phones read the same max token and collide; each retry is two
    // millisecond queries, so even the unluckiest phone lands in ~1s.
    // The DB unique constraint is the source of truth — correctness never
    // depends on timing luck.
    for (let attempt = 0; attempt < 60 && !order; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 15)));
      const last = await db.order.findFirst({
        where: { cafeId: cafe.id, tokenDay },
        orderBy: { tokenNo: "desc" },
        select: { tokenNo: true },
      });
      try {
        order = await db.order.create({
          data: { ...baseData, tokenNo: ((last?.tokenNo || 0) % 999) + 1 },
          include: { items: true },
        });
      } catch (e) {
        // P2002 = another phone grabbed the same token a millisecond earlier. Retry.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 59) continue;
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
  try {
    await db.auditLog.create({ data: { cafeId: cafe.id, action: "ORDER_CREATED", meta: `${order.id} ${order.tableCode} ${total} ${d.paymentMode}${upiRef ? ` ref=${upiRef}` : ""}` } });
  } catch { /* audit must never break ordering */ }

  return NextResponse.json({ ok: true, order: { id: order.id, tokenNo: order.tokenNo, total, status: order.status, tableCode: order.tableCode } });
}
