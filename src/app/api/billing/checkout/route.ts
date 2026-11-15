import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, parseBilling, parsePlan, type Billing, type PlanId } from "@/lib/plans";
import { limitRequest, tooMany } from "@/lib/security";

const Schema = z.object({
  plan: z.string().max(20),
  billing: z.string().max(10),
});

// Platform Razorpay keys (Qtable's own account — NOT the outlet's gateway keys).
function platformKeys(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.BILLING_RAZORPAY_KEY_ID || "";
  const keySecret = process.env.BILLING_RAZORPAY_KEY_SECRET || "";
  return keyId && keySecret ? { keyId, keySecret } : null;
}

// Optional UPI-Autopay/card mandate plan ids. Create one plan per (tier,
// period) in Razorpay → Subscriptions → Plans, then set:
//   BILLING_RAZORPAY_PLAN_STANDARD_MONTHLY=plan_xxx
// If absent, checkout falls back to the one-off Order flow (manual renewal).
function mandatePlanId(plan: PlanId, billing: Billing): string {
  const key = `BILLING_RAZORPAY_PLAN_${plan.toUpperCase()}_${billing.toUpperCase()}`;
  return (process.env[key] || "").trim();
}

// Starts a subscription purchase for the signed-in outlet.
// The amount and outlet id are attached to the Razorpay entity notes, so
// /api/billing/activate (and the webhook) can verify the tenant + price.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await limitRequest(req, "bill-checkout", 10, 60_000))) return tooMany();

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Choose a plan and billing period." }, { status: 400 });

  const plan = parsePlan(p.data.plan);
  const billing = parseBilling(p.data.billing);
  const quote = planQuoteFor(plan, billing);

  const keys = platformKeys();
  if (!keys) {
    // No platform keys yet: the UI falls back to the hosted plan links.
    return NextResponse.json(
      {
        error: "Online checkout isn't connected yet. Pay with the link from Qtable support, then reload this page.",
        fallback: true,
      },
      { status: 503 },
    );
  }

  const cafe = await db.cafe.findUnique({ where: { id: s.cafeId }, select: { name: true } });
  const notes = {
    cafeId: s.cafeId,
    cafeName: cafe?.name || "",
    email: s.email,
    plan,
    billing,
  };
  const rzp = new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });

  // ---- Preferred: recurring mandate (auto-renew) ----
  const planId = mandatePlanId(plan, billing);
  if (planId) {
    try {
      // Guard against a stale/mismatched Razorpay plan id: if its price differs
      // from the price this page quoted, the customer would be charged the wrong
      // amount and activation would rightly refuse. Fall back to one-off.
      const planEntity = (await rzp.plans.fetch(planId)) as unknown as { item?: { amount?: number } };
      const planAmount = Number(planEntity?.item?.amount || 0);
      if (planAmount !== quote.total * 100) {
        console.error("BILL_MANDATE_PRICE_MISMATCH", { planId, planAmount, expected: quote.total * 100 });
        throw new Error("mandate price mismatch");
      }
      const sub = (await rzp.subscriptions.create({
        plan_id: planId,
        // 10 years of cycles; Razorpay stops at the mandate end anyway.
        total_count: billing === "yearly" ? 10 : 120,
        quantity: 1,
        customer_notify: 1,
        notes,
      })) as unknown as { id: string; short_url?: string };
      await db.auditLog
        .create({ data: { cafeId: s.cafeId, userId: s.uid, action: "BILL_MANDATE_STARTED", meta: `${plan} ${billing} ${sub.id}` } })
        .catch(() => {});
      return NextResponse.json({
        mode: "subscription",
        keyId: keys.keyId,
        subscriptionId: sub.id,
        amount: quote.total * 100,
        currency: "INR",
        plan,
        billing,
        name: "Qtable",
        description: `Qtable ${PLANS[plan].name} — ${billing} (auto-renew)`,
        prefill: { email: s.email, name: s.name || "" },
      });
    } catch (e) {
      // Misconfigured plan id must not block revenue: fall through to one-off.
      console.error("BILL_MANDATE_FAIL", e instanceof Error ? e.message : e);
    }
  }

  // ---- Fallback: one-off Order (manual renewal) ----
  try {
    const order = await rzp.orders.create({
      amount: quote.total * 100, // paise
      currency: "INR",
      receipt: `sub_${s.cafeId}`.slice(0, 40),
      // Capture immediately: an authorized-but-uncaptured payment would never
      // emit payment.captured, so the webhook safety net would miss it.
      payment_capture: 1,
      notes,
    });
    await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "BILL_CHECKOUT_STARTED", meta: `${plan} ${billing} ${quote.total} ${order.id}` } }).catch(() => {});
    return NextResponse.json({
      mode: "order",
      keyId: keys.keyId,
      orderId: order.id,
      amount: quote.total * 100,
      currency: "INR",
      plan,
      billing,
      name: "Qtable",
      description: `Qtable ${PLANS[plan].name} — ${billing}`,
      prefill: { email: s.email, name: s.name || "" },
    });
  } catch (e) {
    console.error("BILL_CHECKOUT_FAIL", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't start checkout — try again in a moment." }, { status: 502 });
  }
}

function planQuoteFor(plan: PlanId, billing: Billing) {
  const p = PLANS[plan];
  return billing === "yearly" ? { total: p.yearlyTotal } : { total: p.monthly };
}
