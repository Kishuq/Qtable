import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSubscription, isSubscriptionActive } from "@/lib/billing";
import { db } from "@/lib/db";

// Subscription state for the signed-in outlet. Drives the preview banner,
// the Pro module gates and the subscribe page. Nothing here is secret:
// plan tier, status and the paid-until date are the outlet's own data.
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await getSubscription(s.cafeId);
  const cafe = await db.cafe.findUnique({
    where: { id: s.cafeId },
    select: { name: true, slug: true },
  });
  const active = isSubscriptionActive(sub);

  return NextResponse.json({
    plan: sub?.plan ?? "standard",
    status: sub?.status ?? "pending",
    billing: sub?.billing ?? "monthly",
    paidUntil: sub?.paidUntil ?? null,
    active,
    preview: !active,
    cafe: cafe ? { name: cafe.name, slug: cafe.slug } : null,
    // Razorpay checkout is available only when platform keys are configured.
    checkout: Boolean(process.env.BILLING_RAZORPAY_KEY_ID && process.env.BILLING_RAZORPAY_KEY_SECRET),
  });
}
