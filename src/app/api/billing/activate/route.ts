import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import Razorpay from "razorpay";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, parseBilling, parsePlan } from "@/lib/plans";
import { activateSubscription, planLabel } from "@/lib/billing";
import { sendEmail, invoiceHtml } from "@/lib/email";
import { limitRequest, tooMany } from "@/lib/security";

const Schema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

// Called by the browser immediately after Razorpay checkout succeeds.
// Three independent checks before anything unlocks:
//   1. HMAC signature proves Razorpay produced this pair.
//   2. The order's notes.cafeId must be the signed-in outlet.
//   3. The order amount must equal the current price of that plan.
// The webhook is the safety net for a browser that closes mid-flow.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await limitRequest(req, "bill-activate", 20, 60_000))) return tooMany();

  const keyId = process.env.BILLING_RAZORPAY_KEY_ID || "";
  const keySecret = process.env.BILLING_RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Billing isn't configured on this deployment yet." }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Missing payment details." }, { status: 400 });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = p.data;

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");
  if (
    expected.length !== razorpay_signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))
  ) {
    try { await db.auditLog.create({ data: { cafeId: s.cafeId, action: "BILL_ACTIVATE_SIG_FAIL", meta: razorpay_order_id } }); } catch {}
    return NextResponse.json({ error: "Payment verification failed. If money left your account, contact support — it will be reconciled." }, { status: 400 });
  }

  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
  let order: { amount: number; notes?: Record<string, string> };
  try {
    order = (await rzp.orders.fetch(razorpay_order_id)) as unknown as { amount: number; notes?: Record<string, string> };
  } catch {
    return NextResponse.json({ error: "Couldn't read that payment — try again or contact support." }, { status: 502 });
  }

  const notes = order.notes || {};
  if (notes.cafeId && notes.cafeId !== s.cafeId) {
    return NextResponse.json({ error: "That payment belongs to a different outlet." }, { status: 403 });
  }

  const plan = parsePlan(notes.plan || "standard");
  const billing = parseBilling(notes.billing || "monthly");
  const expectedAmount = (billing === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly) * 100;
  if (Number(order.amount) !== expectedAmount) {
    try { await db.auditLog.create({ data: { cafeId: s.cafeId, action: "BILL_AMOUNT_MISMATCH", meta: `${razorpay_order_id} paid=${order.amount} expected=${expectedAmount}` } }); } catch {}
    return NextResponse.json({ error: "The paid amount doesn't match this plan. Contact support and we'll sort it out." }, { status: 400 });
  }

  const { paidUntil } = await activateSubscription({ cafeId: s.cafeId, plan, billing, ref: razorpay_payment_id, amount: expectedAmount });
  try { await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "BILL_ACTIVATED", meta: `${plan} ${billing} ${razorpay_payment_id}` } }); } catch {}

  // Receipt is best-effort: a mail failure must never undo a paid activation.
  if (s.email) {
    await sendEmail({
      to: s.email,
      subject: `Qtable receipt — ${planLabel(plan)} ${billing} ✓`,
      html: invoiceHtml({
        name: s.name || "there",
        plan: planLabel(plan),
        amount: `₹${(expectedAmount / 100).toLocaleString("en-IN")}`,
        period: billing === "yearly" ? "Yearly" : "Monthly",
        paymentId: razorpay_payment_id,
        subscriptionId: razorpay_order_id,
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      }),
    });
  }

  return NextResponse.json({ ok: true, plan, billing, paidUntil });
}
