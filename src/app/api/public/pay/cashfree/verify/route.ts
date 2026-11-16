import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { limitRequest, tooMany } from "@/lib/security";
import { getCashfreeOrder } from "@/lib/cashfree";
import { markOrderPaid } from "@/lib/cashfree-orders";
import { getCafeCashfree } from "@/lib/paykeys";

const Schema = z.object({
  orderId: z.string().min(1).max(64),
  paymentSessionId: z.string().max(128).optional(),
  cfPaymentId: z.string().max(64).optional(),
});

// Called by the browser right after Cashfree's hosted checkout settles. The
// gateway has no client-side signature to hand us — instead we ask Cashfree
// (server-to-server) whether this order is PAID, and bind the resulting payment
// reference to our database row. The webhook is the same safety net, so this is
// idempotent on purpose.
export async function POST(req: NextRequest) {
  if (!(await limitRequest(req, "cf-verify", 30, 60_000))) return tooMany();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { orderId } = p.data;

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "PAID") {
    return NextResponse.json({ ok: true, orderId, paymentStatus: "PAID", duplicate: true });
  }
  const keys = await getCafeCashfree(order.cafeId);
  if (!keys) return NextResponse.json({ error: "Online payments not enabled" }, { status: 503 });

  const payment = await db.payment.findFirst({
    where: { orderId, mode: "ONLINE", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, providerRef: true },
  });
  if (!payment) return NextResponse.json({ error: "No pending payment for this order" }, { status: 404 });

  const state = await getCashfreeOrder(keys, payment.providerRef);
  if (!state) {
    return NextResponse.json({ error: "Gateway status unavailable — retrying confirmation shortly." }, { status: 502 });
  }
  if (state.status !== "PAID") {
    return NextResponse.json({ error: "Payment still pending" }, { status: 402 });
  }

  const ok = await markOrderPaid({
    orderId,
    cafeId: order.cafeId,
    orderTotal: order.total,
    paymentId: payment.id,
    paidPaise: state.amountPaise,
    paymentRef: state.paymentId || payment.providerRef,
  });
  if (!ok) {
    // Already marked (duplicate confirm) or short-paid (needs human).
    const fresh = await db.order.findUnique({ where: { id: orderId }, select: { paymentStatus: true } });
    if (fresh?.paymentStatus === "PAID") return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json(
      { error: "Payment couldn't be confirmed — stay on this screen; it confirms automatically via the gateway." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, orderId, paymentStatus: "PAID" });
}
