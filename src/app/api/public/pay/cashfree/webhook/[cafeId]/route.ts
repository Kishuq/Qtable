import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markOrderPaid } from "@/lib/cashfree-orders";
import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { getCafeCashfree } from "@/lib/paykeys";

// Cashfree posts payment events to this per-outlet webhook (notify_url we stamp
// on every order). Signed with the outlet's Cashfree key secret; at-least-once
// delivery means we must be idempotent — markOrderPaid already is.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ cafeId: string }> }) {
  // Accept either the outlet id or its public slug, so owners can copy a
  // human-readable URL straight from Settings.
  const { cafeId: ref } = await ctx.params;
  const row =
    (await db.cafe.findUnique({ where: { id: ref }, select: { id: true } })) ||
    (await db.cafe.findUnique({ where: { slug: ref }, select: { id: true } }));
  if (!row) return NextResponse.json({ error: "Unknown outlet" }, { status: 404 });
  const cafeId = row.id;

  const keys = await getCafeCashfree(cafeId);
  if (!keys) return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });

  let raw = "";
  try { raw = await req.text(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const sig = req.headers.get("x-webhook-signature") || "";
  const ts = req.headers.get("x-webhook-timestamp") || "";
  if (!verifyCashfreeWebhook(raw, ts, sig, keys.secretKey)) {
    try { await db.auditLog.create({ data: { cafeId, action: "CF_WEBHOOK_SIG_FAIL" } }); } catch {}
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  type CfEvent = {
    type?: string;
    event?: string;
    data?: {
      order?: {
        order_id?: string;
        order_amount?: number | string;
        order_tags?: Record<string, string> | null;
      };
      payment?: {
        cf_payment_id?: string | number;
        payment_status?: string;
        payment_amount?: number | string;
      };
    };
  };
  let evt: CfEvent | null = null;
  try { evt = JSON.parse(raw) as CfEvent; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const event: string = String(evt?.type || evt?.event || "");
  const data = evt?.data || {};
  const order = data?.order || {};
  const payment = data?.payment || {};
  const orderId = String(order?.order_id || "");
  const paymentStatus: string = String(payment?.payment_status || "");

  if (event === "PAYMENT_SUCCESS_WEBHOOK" || event === "ORDER_CAPTURED") {
    if (paymentStatus !== "SUCCESS") return NextResponse.json({ ok: true });

    // Prefer our signed breadcrumb (order_tags), fall back to the payment row we
    // stored when creating the Cashfree order. Never trust a bare order_id.
    let dbOrderId = String(order?.order_tags?.qtable_order || "");
    if (!dbOrderId && orderId) {
      const row = await db.payment.findFirst({
        where: { providerRef: orderId, mode: "ONLINE" },
        orderBy: { createdAt: "desc" },
        select: { orderId: true },
      });
      dbOrderId = row?.orderId || "";
    }
    if (!dbOrderId) return NextResponse.json({ ok: true, ignored: "unknown-order" });

    const dbOrder = await db.order.findUnique({ where: { id: dbOrderId } });
    // A webhook signed by outlet A's keys must never settle outlet B's order.
    if (!dbOrder || dbOrder.cafeId !== cafeId) {
      return NextResponse.json({ ok: true, ignored: "foreign-order" });
    }

    const paidPaise = Math.round(Number(payment?.payment_amount ?? dbOrder.total) * 100);
    const ok = await markOrderPaid({
      orderId: dbOrder.id,
      cafeId: dbOrder.cafeId,
      orderTotal: dbOrder.total,
      paymentRef: String(payment?.cf_payment_id || order?.order_id || orderId),
      paidPaise,
      providerRef: orderId || undefined,
    });
    if (ok) {
      await db.auditLog
        .create({ data: { cafeId: dbOrder.cafeId, action: "CF_PAID", meta: `${dbOrder.id} ${payment?.cf_payment_id || ""} ${paidPaise}` } })
        .catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  // PAYMENT_FAILED / USER_DROPPED / CHARGES / anything else: no state change.
  // The customer's order stays PENDING at the counter — no money movement
  // happened on OUR books, so nothing to reconcile here.
  return NextResponse.json({ ok: true });
}
