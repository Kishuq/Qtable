import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";

// Stripe webhook — the ONLY thing allowed to mark a Stripe order PAID.
// Configure in Stripe dashboard: endpoint /api/pay/stripe/webhook, event checkout.session.completed.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret || !whSecret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secret);
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch {
    await db.auditLog.create({ data: { action: "STRIPE_SIG_FAIL" } });
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId || "";
    if (session.payment_status === "paid" && orderId) {
      const order = await db.order.findUnique({ where: { id: orderId } });
      // Bind the session to this order + its server-side amount; a signed event
      // for a different charge must never mark this order paid.
      if (order && session.amount_total === order.total && (session.currency || "inr").toLowerCase() === "inr") {
        // Stripe's signature + metadata + server-side amount already prove this
        // charge belongs to the order. Prefer the row created for this session;
        // fall back to any pending row so a second checkout window still settles.
        const target =
          (await db.payment.findFirst({ where: { orderId, status: "PENDING", providerRef: session.id }, select: { id: true } })) ||
          (await db.payment.findFirst({ where: { orderId, status: "PENDING" }, select: { id: true } }));
        if (target) {
          await db.$transaction([
            db.payment.updateMany({ where: { id: target.id, status: "PENDING" }, data: { status: "PAID", providerRef: String(session.payment_intent || session.id) } }),
            db.order.updateMany({ where: { id: orderId, paymentStatus: { not: "PAID" } }, data: { paymentStatus: "PAID" } }),
          ]);
        } else {
          await db.order.updateMany({ where: { id: orderId, paymentStatus: { not: "PAID" } }, data: { paymentStatus: "PAID" } });
        }
        await db.auditLog.create({ data: { cafeId: order.cafeId, action: "STRIPE_PAID", meta: `${orderId} ${session.id} ${order.total}` } });
      }
    }
  }
  return NextResponse.json({ received: true });
}
