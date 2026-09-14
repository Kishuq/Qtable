import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { rateLimit, clientKey, tooMany } from "@/lib/security";

const Schema = z.object({ orderId: z.string().min(1).max(64) });

// Stripe Checkout Session (hosted, redirect). Amount comes from OUR database.
// Confirmation arrives via webhook — never trust the redirect alone.
export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "stripe"), 20, 60_000)) return tooMany();
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Online payments not enabled by this cafe yet." }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid order" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id: p.data.orderId }, include: { items: true } });
  if (!order || order.paymentStatus === "PAID" || order.status === "CANCELLED") {
    return NextResponse.json({ error: "Order not payable" }, { status: 400 });
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "inr",
          unit_amount: order.total,
          product_data: { name: `Order #${order.tokenNo} — Table ${order.tableCode}` },
        },
        quantity: 1,
      }],
      success_url: `${base}/order/${order.id}?paid=1`,
      cancel_url: `${base}/order/${order.id}?cancelled=1`,
      metadata: { orderId: order.id },
    });
    await db.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { providerRef: session.id } });
    await db.auditLog.create({ data: { cafeId: order.cafeId, action: "STRIPE_SESSION", meta: `${order.id} ${session.id}` } });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe session failed", e);
    return NextResponse.json({ error: "Payment gateway unreachable. Try UPI or counter." }, { status: 502 });
  }
}
