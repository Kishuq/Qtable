import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, parseBilling, parsePlan } from "@/lib/plans";
import { limitRequest, tooMany } from "@/lib/security";
import { cashfreeOrderId, createCashfreeOrder, platformCashfree } from "@/lib/cashfree";
import { absoluteUrl } from "@/lib/url";

const Schema = z.object({
  plan: z.string().max(20),
  billing: z.string().max(10),
});

// Qtable's own payment contact for receipts. Prefer the signed-in owner so the
// gateway receipt and ours reach the same inbox.
function platformCustomer(s: { cafeId: string; name?: string; email?: string }) {
  const email = (s.email || process.env.BILLING_CASHFREE_EMAIL || "").trim();
  return {
    id: s.cafeId,
    name: (s.name || "Qtable owner").slice(0, 100),
    ...(email ? { email } : {}),
    phone: "9999999999",
  };
}

// Starts a subscription purchase for the signed-in outlet. Qtable collects the
// money through its own Cashfree account and stamps the outlet + plan into the
// order tags, so /api/billing/activate (and the webhook) can verify both the
// tenant and the price — the customer can never influence either.
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
  const quote = billing === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly;

  const keys = platformCashfree();
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
  const orderId = cashfreeOrderId("QT");
  const order = await createCashfreeOrder(keys, {
    orderId,
    amountPaise: quote * 100,
    customer: platformCustomer({ cafeId: s.cafeId, name: s.name, email: s.email }),
    note: `Qtable ${PLANS[plan].name} — ${billing}`,
    tags: { cafeId: s.cafeId, plan, billing, cafeName: cafe?.name || "" },
    returnUrl: absoluteUrl(`/subscribe?cf_order_id=${orderId}`),
  });

  await db.auditLog
    .create({ data: { cafeId: s.cafeId, userId: s.uid, action: "CF_CHECKOUT_STARTED", meta: `${plan} ${billing} ${orderId}` } })
    .catch(() => {});

  return NextResponse.json({
    mode: "order",
    // The browser SDK must be constructed with the same environment the server
    // used, otherwise a sandbox session is rejected by the live SDK.
    env: keys.live ? "production" : "sandbox",
    paymentSessionId: order.paymentSessionId,
    cashfreeOrderId: orderId,
    amount: quote * 100,
    currency: "INR",
    plan,
    billing,
    name: "Qtable",
    description: `Qtable ${PLANS[plan].name} — ${billing}`,
    prefill: { email: s.email, name: s.name || "" },
  });
}
