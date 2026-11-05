import { NextResponse } from "next/server";
import { db } from "./db";
import type { PlanId } from "./plans";

// Per-outlet subscription state. The database is the source of truth;
// Razorpay checkout/webhooks (or a manual DB flip) activate an outlet.
// New signups start "pending" → the dashboard opens in preview mode and
// every write is refused until the outlet is active.
export type Plan = PlanId;
export type SubStatus = "pending" | "active" | "past_due" | "canceled";

export type Subscription = {
  plan: Plan;
  status: SubStatus;
  billing: "monthly" | "yearly";
  paidUntil: Date | null;
  ref: string;
};

export function normalizePlan(v: string | null | undefined): Plan {
  const p = (v || "").toLowerCase().trim();
  return p === "menu" || p === "standard" || p === "pro" ? p : "standard";
}

// Customer ordering stack (cart, checkout, payments, waiter, coupons).
export function planAllowsOrdering(plan: Plan): boolean {
  return plan === "standard" || plan === "pro";
}

// Pro-only dashboard modules (inventory, insights, coupons, staff).
export function planAllowsPro(plan: Plan): boolean {
  return plan === "pro";
}

export async function getSubscription(cafeId: string): Promise<Subscription | null> {
  const c = await db.cafe.findUnique({
    where: { id: cafeId },
    select: { planTier: true, subStatus: true, subBilling: true, subPaidUntil: true, subRef: true },
  });
  if (!c) return null;
  return {
    plan: normalizePlan(c.planTier),
    status: (["pending", "active", "past_due", "canceled"].includes(c.subStatus) ? c.subStatus : "pending") as SubStatus,
    billing: c.subBilling === "yearly" ? "yearly" : "monthly",
    paidUntil: c.subPaidUntil,
    ref: c.subRef,
  };
}

// "active" must also not be past its paid-until date. A null date means a
// manually-activated / legacy outlet, which stays active indefinitely.
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub || sub.status !== "active") return false;
  return !sub.paidUntil || sub.paidUntil.getTime() > Date.now();
}

export async function getPlanFor(cafeId: string): Promise<Plan> {
  const sub = await getSubscription(cafeId);
  return sub?.plan ?? "standard";
}

export async function isProCafe(cafeId: string): Promise<boolean> {
  return planAllowsPro(await getPlanFor(cafeId));
}

// Customer-facing reason why this outlet cannot take an order right now.
// null = ordering is allowed. Used by the public order/waiter/pay routes so
// preview mode blocks writes even if someone crafts a request by hand.
export async function orderingBlockedReason(cafeId: string): Promise<string | null> {
  const sub = await getSubscription(cafeId);
  if (!isSubscriptionActive(sub)) {
    return "This outlet isn't accepting online orders yet — please order at the counter.";
  }
  if (!planAllowsOrdering(sub!.plan)) {
    return "Online ordering isn't enabled at this outlet — please order at the counter.";
  }
  return null;
}

// Server-side paywall. Returns a ready-to-return 402, or null when allowed.
// Every mutating route calls this so preview mode can't be bypassed by a
// crafted request — the UI lock is just the polite layer.
export async function subscriptionGate(cafeId: string): Promise<NextResponse | null> {
  const sub = await getSubscription(cafeId);
  if (isSubscriptionActive(sub)) return null;
  return NextResponse.json(
    {
      error: "This outlet is in preview mode. Subscribe to unlock changes.",
      subscriptionRequired: true,
      status: sub?.status ?? "pending",
    },
    { status: 402 },
  );
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  // Jan 31 + 1 month should land in March, not overflow into March 3.
  if (next.getDate() < day) next.setDate(0);
  return next;
}

// Extends an existing paid period instead of truncating it (renewals, upgrades).
export async function activateSubscription(o: {
  cafeId: string;
  plan: Plan;
  billing: "monthly" | "yearly";
  ref: string;
  /** Amount actually collected, in paise. Recorded in the billing ledger. */
  amount?: number;
}): Promise<{ paidUntil: Date; renewal: boolean }> {
  const cafe = await db.cafe.findUnique({
    where: { id: o.cafeId },
    select: { subPaidUntil: true, subStartedAt: true },
  });
  const now = new Date();
  const from = cafe?.subPaidUntil && cafe.subPaidUntil.getTime() > now.getTime() ? cafe.subPaidUntil : now;
  const paidUntil = addMonths(from, o.billing === "yearly" ? 12 : 1);
  const renewal = Boolean(cafe?.subStartedAt);
  await db.cafe.update({
    where: { id: o.cafeId },
    data: {
      planTier: o.plan,
      subStatus: "active",
      subBilling: o.billing,
      subPaidUntil: paidUntil,
      subRef: o.ref,
      subStartedAt: cafe?.subStartedAt ?? now,
    },
  });
  // The ledger must never be the reason an activation fails — payment already
  // cleared. Best-effort like audit logs.
  try {
    await db.billingEvent.create({
      data: {
        cafeId: o.cafeId,
        kind: renewal ? "renewal" : "activated",
        plan: o.plan,
        billing: o.billing,
        amount: Math.max(0, Math.round(o.amount || 0)),
        ref: o.ref,
        meta: `paidUntil=${paidUntil.toISOString()}`,
      },
    });
  } catch { /* ledger is best-effort */ }
  return { paidUntil, renewal };
}

export async function markPastDue(cafeId: string): Promise<void> {
  const updated = await db.cafe
    .update({ where: { id: cafeId }, data: { subStatus: "past_due" } })
    .catch(() => null);
  if (!updated) return;
  try {
    await db.billingEvent.create({ data: { cafeId, kind: "expired" } });
  } catch { /* best-effort */ }
}

export function planLabel(plan: Plan): string {
  return plan === "menu" ? "Basic" : plan === "pro" ? "Pro" : "Standard";
}
