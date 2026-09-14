import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { db } from "@/lib/db";
import { rateLimit, clientKey, tooMany } from "@/lib/security";

function rzp() {
  const id = process.env.RAZORPAY_KEY_ID || "";
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!id || !secret) return null;
  return { client: new Razorpay({ key_id: id, key_secret: secret }), keyId: id };
}

const Schema = z.object({ orderId: z.string().min(1).max(64) });

// Creates a Razorpay order for an already-placed PENDING order.
// Amount is taken from OUR database — the client can never set the price.
export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "rzp"), 20, 60_000)) return tooMany();
  const r = rzp();
  if (!r) return NextResponse.json({ error: "Online payments not enabled by this cafe yet. Please pay at counter or via UPI." }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid order" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id: p.data.orderId }, include: { cafe: true } });
  if (!order || order.paymentStatus === "PAID" || order.status === "CANCELLED") {
    return NextResponse.json({ error: "Order not payable" }, { status: 400 });
  }
  try {
    const rzOrder = await r.client.orders.create({ amount: order.total, currency: "INR", receipt: order.id.slice(0, 40) });
    await db.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { providerRef: String(rzOrder.id) } });
    await db.auditLog.create({ data: { cafeId: order.cafeId, action: "RZP_ORDER", meta: `${order.id} ${rzOrder.id}` } });
    return NextResponse.json({
      keyId: r.keyId, rzpOrderId: rzOrder.id, amount: order.total, currency: "INR",
      name: order.cafe.name, tokenNo: order.tokenNo,
    });
  } catch (e) {
    console.error("Razorpay create failed", e);
    return NextResponse.json({ error: "Payment gateway unreachable. Try UPI or counter." }, { status: 502 });
  }
}
