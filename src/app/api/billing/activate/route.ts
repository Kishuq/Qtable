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

const Schema = z
  .object({
    razorpay_order_id: z.string().min(1).max(64).optional(),
    razorpay_subscription_id: z.string().min(1).max(64).optional(),
    razorpay_payment_id: z.string().min(1).max(80),
    razorpay_signature: z.string().min(1).max(256),
  })
  .refine((v) => Boolean(v.razorpay_order_id || v.razorpay_subscription_id), {
    message: "Missing order or subscription id",
  });

type OrderEntity = { amount: number; notes?: Record<string, string> };
type SubEntity = { id: string; notes?: Record<string, string>; plan_id?: string };
type PayEntity = { amount: number; order_id?: string };

function safeEqual(a: string, b: string): boolean {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Called by the browser immediately after Razorpay checkout succeeds.
// Independent checks before anything unlocks:
//   1. HMAC signature proves Razorpay produced this pair (order or subscription).
//   2. The entity's notes.cafeId must be the signed-in outlet.
//   3. The charged amount must match the current price of that plan.
//   4. txnKey makes a webhook retry / double callback idempotent.
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

  const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = p.data;
  const isSubscription = Boolean(razorpay_subscription_id);

  // Subscription checkout signs `payment_id|subscription_id`; one-off orders
  // sign `order_id|payment_id`.
  const signed = isSubscription
    ? `${razorpay_payment_id}|${razorpay_subscription_id}`
    : `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", keySecret).update(signed).digest("hex");
  if (!safeEqual(expected, razorpay_signature)) {
    try { await db.auditLog.create({ data: { cafeId: s.cafeId, action: "BILL_ACTIVATE_SIG_FAIL", meta: isSubscription ? `sub:${razorpay_subscription_id}` : `order:${razorpay_order_id}` } }); } catch {}
    return NextResponse.json({ error: "Payment verification failed. If money left your account, contact support — it will be reconciled." }, { status: 400 });
  }

  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

  let plan = parsePlan("standard");
  let billing = parseBilling("monthly");
  let amountPaise = 0;
  let txnKey = "";
  let mandateId: string | undefined;
  let ref = razorpay_payment_id;

  try {
    if (isSubscription) {
      const sub = (await rzp.subscriptions.fetch(razorpay_subscription_id!)) as unknown as SubEntity;
      const notes = sub.notes || {};
      // Every checkout we create stamps cafeId. A payment without it is not
      // ours to unlock, so refuse rather than guessing.
      if (notes.cafeId !== s.cafeId) {
        return NextResponse.json({ error: "That payment belongs to a different outlet." }, { status: 403 });
      }
      plan = parsePlan(notes.plan || "standard");
      billing = parseBilling(notes.billing || "monthly");
      const pay = (await rzp.payments.fetch(razorpay_payment_id)) as unknown as PayEntity;
      amountPaise = Number(pay.amount || 0);
      txnKey = `sub:${razorpay_subscription_id}:${razorpay_payment_id}`;
      mandateId = razorpay_subscription_id!;
      ref = razorpay_subscription_id!;
    } else {
      const order = (await rzp.orders.fetch(razorpay_order_id!)) as unknown as OrderEntity;
      const notes = order.notes || {};
      if (notes.cafeId !== s.cafeId) {
        return NextResponse.json({ error: "That payment belongs to a different outlet." }, { status: 403 });
      }
      plan = parsePlan(notes.plan || "standard");
      billing = parseBilling(notes.billing || "monthly");
      amountPaise = Number(order.amount || 0);
      txnKey = `order:${razorpay_order_id}`;
    }
  } catch {
    return NextResponse.json({ error: "Couldn't read that payment — try again or contact support." }, { status: 502 });
  }

  const expectedAmount = (billing === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly) * 100;
  if (amountPaise < expectedAmount) {
    try { await db.auditLog.create({ data: { cafeId: s.cafeId, action: "BILL_AMOUNT_MISMATCH", meta: `${txnKey} paid=${amountPaise} expected=${expectedAmount}` } }); } catch {}
    return NextResponse.json({ error: "The paid amount doesn't match this plan. Contact support and we'll sort it out." }, { status: 400 });
  }

  const { paidUntil, duplicate } = await activateSubscription({
    cafeId: s.cafeId,
    plan,
    billing,
    ref,
    amount: amountPaise,
    txnKey,
    mandateId,
  });

  if (!duplicate) {
    try { await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "BILL_ACTIVATED", meta: `${plan} ${billing} ${txnKey}` } }); } catch {}

    // Receipt is best-effort: a mail failure must never undo a paid activation.
    if (s.email) {
      await sendEmail({
        to: s.email,
        subject: `Qtable receipt — ${planLabel(plan)} ${billing} ✓`,
        html: invoiceHtml({
          name: s.name || "there",
          plan: planLabel(plan),
          amount: `₹${(amountPaise / 100).toLocaleString("en-IN")}`,
          period: billing === "yearly" ? "Yearly" : "Monthly",
          paymentId: razorpay_payment_id,
          subscriptionId: mandateId || razorpay_order_id || "—",
          date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        }),
      });
    }
  }

  return NextResponse.json({ ok: true, plan, billing, paidUntil, duplicate, autoRenew: Boolean(mandateId) });
}
