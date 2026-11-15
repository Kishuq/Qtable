import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { limitRequest, tooMany } from "@/lib/security";

const Schema = z.object({
  orderId: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

// Verifies the Razorpay signature server-side (HMAC-SHA256).
// Money is ONLY marked PAID if the gateway's own signature checks out —
// a customer can never fake this from devtools.
export async function POST(req: NextRequest) {
  if (!(await limitRequest(req, "rzp-verify", 30, 60_000))) return tooMany();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = p.data;

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  // HMAC secret comes from the outlet's own gateway config (env fallback).
  const { getCafeRazorpay } = await import("@/lib/paykeys");
  const keys = await getCafeRazorpay(order.cafeId);
  if (!keys) return NextResponse.json({ error: "Online payments not enabled" }, { status: 503 });
  const secret = keys.keySecret;

  const expected = crypto.createHmac("sha256", secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if (expected.length !== razorpay_signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
    await db.auditLog.create({ data: { action: "RZP_SIG_FAIL", meta: `${orderId} ${razorpay_payment_id}` } });
    return NextResponse.json({ error: "Payment verification failed. If money left your account it will auto-refund — contact the counter." }, { status: 400 });
  }

  // The signature only proves "this gateway order was paid". Bind it to THIS
  // database order, otherwise a valid signature for a ₹100 order could be
  // replayed to mark a ₹5,000 order paid.
  const replay = await db.payment.findFirst({
    where: { orderId, status: "PAID", providerRef: razorpay_payment_id },
    select: { id: true },
  });
  if (replay) return NextResponse.json({ ok: true, duplicate: true });

  const target = await db.payment.findFirst({
    where: { orderId, status: "PENDING", providerRef: razorpay_order_id },
    select: { id: true },
  });
  if (!target) {
    await db.auditLog.create({ data: { cafeId: order.cafeId, action: "RZP_ORDER_MISMATCH", meta: `${orderId} got=${razorpay_order_id}` } });
    return NextResponse.json({ error: "That payment doesn't match this order. Show the counter your payment receipt." }, { status: 400 });
  }

  // Idempotent: a retried callback marks the same row once and doesn't spam
  // the audit log or flip an already-paid order.
  const updated = await db.payment.updateMany({
    where: { id: target.id, status: "PENDING" },
    data: { status: "PAID", providerRef: razorpay_payment_id },
  });
  if (updated.count > 0) {
    await db.order.updateMany({ where: { id: orderId, paymentStatus: { not: "PAID" } }, data: { paymentStatus: "PAID" } });
    await db.auditLog.create({ data: { cafeId: order.cafeId, action: "RZP_PAID", meta: `${orderId} ${razorpay_payment_id} ${order.total}` } });
  }
  return NextResponse.json({ ok: true });
}
