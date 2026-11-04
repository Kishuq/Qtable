import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, parseBilling, parsePlan } from "@/lib/plans";
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

// Starts a subscription purchase for the signed-in outlet.
// The amount and the outlet id are attached to the Razorpay order as notes, so
// /api/billing/activate can verify what was actually paid before unlocking.
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
  const rzp = new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
  try {
    const order = await rzp.orders.create({
      amount: quote.total * 100, // paise
      currency: "INR",
      receipt: `sub_${s.cafeId}`.slice(0, 40),
      notes: {
        cafeId: s.cafeId,
        cafeName: cafe?.name || "",
        email: s.email,
        plan,
        billing,
      },
    });
    await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "BILL_CHECKOUT_STARTED", meta: `${plan} ${billing} ${quote.total} ${order.id}` } }).catch(() => {});
    return NextResponse.json({
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

function planQuoteFor(plan: ReturnType<typeof parsePlan>, billing: ReturnType<typeof parseBilling>) {
  const p = PLANS[plan];
  return billing === "yearly" ? { total: p.yearlyTotal } : { total: p.monthly };
}
