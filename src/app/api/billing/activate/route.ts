import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, parsePlan } from "@/lib/plans";
import { activateSubscription, planLabel } from "@/lib/billing";
import { sendEmail, invoiceHtml } from "@/lib/email";
import { getCashfreeOrder, platformCashfree } from "@/lib/cashfree";
import { limitRequest, tooMany } from "@/lib/security";

const Schema = z.object({
  orderId: z.string().min(3).max(45),
});

// Called by the browser after Cashfree's hosted checkout redirects back with
// the order id. There is no client signature to verify here (Cashfree signs
// server-to-server), so we ask the gateway directly:
//   1. GET /pg/orders/{id}          → proves the charge exists and is settled
//   2. order_status === "PAID"      → money really moved
//   3. order_tags.cafeId === this outlet → the charge belongs to us
//   4. charged amount >= plan price → never activate a wrong-price payment
// The webhook is the safety net for a browser that closes mid-flow, and both
// paths funnel through activateSubscription's txnKey.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await limitRequest(req, "bill-activate", 20, 60_000))) return tooMany();

  const keys = platformCashfree();
  if (!keys) {
    return NextResponse.json({ error: "Billing isn't configured on this deployment yet." }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Missing order id." }, { status: 400 });
  const orderId = p.data.orderId;

  const order = await getCashfreeOrder(keys, orderId);
  if (!order) {
    return NextResponse.json({ error: "Couldn't read that payment — try again or contact support." }, { status: 502 });
  }
  if (order.status !== "PAID") {
    return NextResponse.json({ error: "Payment is not confirmed yet. Hold tight — it confirms automatically." }, { status: 402 });
  }
  if (order.tags.cafeId !== s.cafeId) {
    return NextResponse.json({ error: "That payment belongs to a different outlet." }, { status: 403 });
  }

  const plan = parsePlan(order.tags.plan || "standard");
  const billing = order.tags.billing === "yearly" ? "yearly" : "monthly";
  const expectedPaise = (billing === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly) * 100;
  const amountPaise = order.amountPaise || expectedPaise;
  if (amountPaise < expectedPaise) {
    try { await db.auditLog.create({ data: { cafeId: s.cafeId, action: "BILL_AMOUNT_MISMATCH", meta: `${orderId} paid=${amountPaise} expected=${expectedPaise}` } }); } catch {}
    return NextResponse.json({ error: "The paid amount doesn't match this plan. Contact support and we'll sort it out." }, { status: 400 });
  }

  const { paidUntil, duplicate } = await activateSubscription({
    cafeId: s.cafeId,
    plan,
    billing,
    ref: String(order.paymentId || order.orderId),
    amount: amountPaise,
    txnKey: `order:${order.orderId}`,
  });

  if (!duplicate) {
    try { await db.auditLog.create({ data: { cafeId: s.cafeId, action: "CF_ACTIVATED", meta: `${plan} ${billing} ${order.orderId}` } }); } catch {}

    const cafeRow = await db.cafe.findUnique({ where: { id: s.cafeId }, select: { ownerId: true } });
    const owner = cafeRow?.ownerId ? await db.user.findUnique({ where: { id: cafeRow.ownerId }, select: { email: true, name: true } }).catch(() => null) : null;
    if (owner?.email) {
      await sendEmail({
        to: owner.email,
        subject: `Qtable receipt — ${planLabel(plan)} ${billing} ✓`,
        html: invoiceHtml({
          name: owner.name || "there",
          plan: planLabel(plan),
          amount: `₹${(amountPaise / 100).toLocaleString("en-IN")}`,
          period: billing === "yearly" ? "Yearly" : "Monthly",
          paymentId: order.paymentId || order.orderId,
          subscriptionId: order.orderId,
          date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        }),
      });
    }
  }

  return NextResponse.json({ ok: true, plan, billing, paidUntil, duplicate, autoRenew: false });
}
