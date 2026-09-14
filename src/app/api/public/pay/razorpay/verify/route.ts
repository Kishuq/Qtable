import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { rateLimit, clientKey, tooMany } from "@/lib/security";

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
  if (!rateLimit(clientKey(req, "rzp-verify"), 30, 60_000)) return tooMany();
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!secret) return NextResponse.json({ error: "Online payments not enabled" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = p.data;

  const expected = crypto.createHmac("sha256", secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if (expected.length !== razorpay_signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
    await db.auditLog.create({ data: { action: "RZP_SIG_FAIL", meta: `${orderId} ${razorpay_payment_id}` } });
    return NextResponse.json({ error: "Payment verification failed. If money left your account it will auto-refund — contact the counter." }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  await db.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
  await db.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "PAID", providerRef: razorpay_payment_id } });
  await db.auditLog.create({ data: { cafeId: order.cafeId, action: "RZP_PAID", meta: `${orderId} ${razorpay_payment_id} ${order.total}` } });
  return NextResponse.json({ ok: true });
}
