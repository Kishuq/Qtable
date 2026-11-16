import { NextResponse } from "next/server";
import { db } from "./db";
import type { PlanId } from "./plans";

// Per-outlet subscription state. The database is the source of truth;
// Cashfree checkout/webhooks (or a platform admin action) activate an outlet.
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
  mandateId: string;
  autoRenew: boolean;
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

// Small grace window after the paid-until date. A bank/UPI mandate can settle
// a few hours late; cutting a café's QR ordering off at midnight creates a
// support incident for a payment that has actually left the customer's account.
// Default 2 days, configurable 0–14. Never applies to legacy (null) periods.
export function graceDays(): number {
  const raw = Number(process.env.BILLING_GRACE_DAYS ?? "2");
  if (!Number.isFinite(raw)) return 2;
  return Math.min(14, Math.max(0, Math.floor(raw)));
}

export function graceEndsAt(paidUntil: Date | null): Date | null {
  if (!paidUntil) return null;
  return new Date(paidUntil.getTime() + graceDays() * 24 * 60 * 60 * 1000);
}

// Builds the subscription view from a Cafe row that is already loaded.
// Hot public routes (menu, ordering) fetch the cafe anyway, so reusing those
// columns saves one database round trip per request — which is most of the
// cost at high concurrency.
export function subscriptionFromCafe(c: {
  planTier: string;
  subStatus: string;
  subBilling: string;
  subPaidUntil: Date | null;
  subRef: string;
  subMandateId: string;
  subAutoRenew: boolean;
}): Subscription {
  return {
    plan: normalizePlan(c.planTier),
    status: (["pending", "active", "past_due", "canceled"].includes(c.subStatus) ? c.subStatus : "pending") as SubStatus,
    billing: c.subBilling === "yearly" ? "yearly" : "monthly",
    paidUntil: c.subPaidUntil,
    ref: c.subRef,
    mandateId: c.subMandateId,
    autoRenew: c.subAutoRenew,
  };
}

export async function getSubscription(cafeId: string): Promise<Subscription | null> {
  const c = await db.cafe.findUnique({
    where: { id: cafeId },
    select: {
      planTier: true, subStatus: true, subBilling: true, subPaidUntil: true, subRef: true,
      subMandateId: true, subAutoRenew: true,
    },
  });
  if (!c) return null;
  return subscriptionFromCafe(c);
}

// "active" must also not be past its paid-until date (+ grace). A null date
// means a manually-activated / legacy outlet, which stays active indefinitely.
export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub || sub.status !== "active") return false;
  if (!sub.paidUntil) return true;
  const deadline = graceEndsAt(sub.paidUntil);
  return Boolean(deadline && deadline.getTime() > Date.now());
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
export function orderingBlockedReasonFor(sub: Subscription | null): string | null {
  if (!isSubscriptionActive(sub)) {
    return "This outlet isn't accepting online orders yet — please order at the counter.";
  }
  if (!planAllowsOrdering(sub!.plan)) {
    return "Online ordering isn't enabled at this outlet — please order at the counter.";
  }
  return null;
}

export async function orderingBlockedReason(cafeId: string): Promise<string | null> {
  return orderingBlockedReasonFor(await getSubscription(cafeId));
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

export type ActivateInput = {
  cafeId: string;
  plan: Plan;
  billing: "monthly" | "yearly";
  ref: string;
  /** Amount actually collected, in paise. Recorded in the billing ledger. */
  amount?: number;
  /**
   * Canonical idempotency key for this charge, e.g. `order:<gateway_order_id>`
   * or `sub:<subscription_id>:<payment_id>`. Two callbacks for the same money
   * (browser + webhook, or a webhook retry) extend the period exactly once.
   */
  txnKey?: string;
  /** Optional mandate/subscription id for auto-renew. */
  mandateId?: string;
  /** Admin overrides: number of months to add. */
  months?: number;
};

export type ActivateResult = { paidUntil: Date | null; renewal: boolean; duplicate: boolean };

// Extends an existing paid period instead of truncating it (renewals, upgrades).
//
// Concurrency: the café row is locked FOR UPDATE inside the transaction, and
// the ledger's unique txnKey is the second line of defence. Without both, a
// slow browser callback racing the webhook could grant two months for one
// payment, and two simultaneous renewals could lose an increment.
export async function activateSubscription(o: ActivateInput): Promise<ActivateResult> {
  const txnKey = o.txnKey?.trim() || null;
  const months = o.months && o.months > 0 ? Math.min(36, Math.floor(o.months)) : o.billing === "yearly" ? 12 : 1;

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ subPaidUntil: Date | null; subStartedAt: Date | null; subStatus: string }>>`
      SELECT "subPaidUntil", "subStartedAt", "subStatus"
      FROM "Cafe" WHERE "id" = ${o.cafeId} FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new Error("CAFE_NOT_FOUND");

    if (txnKey) {
      const already = await tx.billingEvent.findUnique({ where: { txnKey }, select: { id: true } });
      if (already) {
        return { paidUntil: row.subPaidUntil, renewal: false, duplicate: true };
      }
    }

    const now = new Date();
    const from = row.subPaidUntil && row.subPaidUntil.getTime() > now.getTime() ? row.subPaidUntil : now;
    const paidUntil = addMonths(from, months);
    const renewal = Boolean(row.subStartedAt);

    await tx.cafe.update({
      where: { id: o.cafeId },
      data: {
        planTier: o.plan,
        subStatus: "active",
        subBilling: o.billing,
        subPaidUntil: paidUntil,
        subRef: o.ref,
        subStartedAt: row.subStartedAt ?? now,
        ...(o.mandateId !== undefined ? { subMandateId: o.mandateId, subAutoRenew: Boolean(o.mandateId) } : {}),
      },
    });

    // The ledger is part of the same transaction: if it fails, the period
    // change rolls back too. Money records are never "best effort".
    await tx.billingEvent.create({
      data: {
        cafeId: o.cafeId,
        kind: renewal ? "renewal" : "activated",
        plan: o.plan,
        billing: o.billing,
        amount: Math.max(0, Math.round(o.amount || 0)),
        ref: o.ref,
        txnKey,
        meta: `paidUntil=${paidUntil.toISOString()}${o.mandateId ? ` mandate=${o.mandateId}` : ""}`,
      },
    });

    return { paidUntil, renewal, duplicate: false };
  });
}

// Platform-admin escape hatch (comp, manual bank transfer, refund, cancel).
// txnKey keeps repeated admin clicks idempotent.
export async function setSubscriptionStatus(o: {
  cafeId: string;
  status: SubStatus;
  note: string;
  txnKey?: string;
  plan?: Plan;
  billing?: "monthly" | "yearly";
  months?: number;
  amount?: number;
}): Promise<{ ok: boolean; duplicate?: boolean }> {
  if (o.status === "active") {
    await activateSubscription({
      cafeId: o.cafeId,
      plan: o.plan ?? (await getPlanFor(o.cafeId)),
      billing: o.billing ?? "monthly",
      ref: o.txnKey ?? "",
      amount: o.amount ?? 0,
      txnKey: o.txnKey,
      months: o.months,
    });
    return { ok: true };
  }

  return db.$transaction(async (tx) => {
    if (o.txnKey) {
      const already = await tx.billingEvent.findUnique({ where: { txnKey: o.txnKey }, select: { id: true } });
      if (already) return { ok: true, duplicate: true };
    }
    await tx.cafe.update({
      where: { id: o.cafeId },
      data: {
        subStatus: o.status,
        ...(o.status === "canceled" ? { subAutoRenew: false } : {}),
      },
    });
    await tx.billingEvent.create({
      data: {
        cafeId: o.cafeId,
        kind: o.status === "canceled" ? "canceled" : "expired",
        plan: o.plan ?? "",
        billing: o.billing ?? "",
        amount: Math.max(0, Math.round(o.amount ?? 0)),
        ref: o.txnKey ?? "",
        txnKey: o.txnKey ?? null,
        meta: o.note.slice(0, 300),
      },
    });
    return { ok: true };
  });
}

export async function markPastDue(cafeId: string): Promise<boolean> {
  const result = await db.cafe.updateMany({
    where: { id: cafeId, subStatus: "active" },
    data: { subStatus: "past_due" },
  });
  if (result.count === 0) return false;
  await db.billingEvent
    .create({ data: { cafeId, kind: "expired" } })
    .catch(() => undefined);
  return true;
}

export function planLabel(plan: Plan): string {
  return plan === "menu" ? "Basic" : plan === "pro" ? "Pro" : "Standard";
}
