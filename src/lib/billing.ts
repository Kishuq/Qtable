import Stripe from "stripe";

// Billing state per cafe deployment
export type BillingState = {
  mode: "none" | "enforced"; // "none" = app works fully open, "enforced" = subscription required
  status: "open" | "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "unknown";
  renewsAt?: number; // Unix timestamp (ms) when subscription renews
};

// Which gateway holds YOUR platform subscription for this outlet:
// "stripe" (default) or "razorpay". Razorpay fits Indian outlets (UPI Autopay).
function billingProvider(): "stripe" | "razorpay" | "none" {
  const subId = process.env.BILLING_SUBSCRIPTION_ID || "";
  if (!subId) return "none";
  const p = (process.env.BILLING_PROVIDER || "").toLowerCase();
  if (p === "razorpay") return "razorpay";
  if (p === "stripe") return "stripe";
  // Auto-detect: prefer whichever platform keys are present.
  if (process.env.BILLING_RAZORPAY_KEY_ID || (!process.env.STRIPE_SECRET_KEY && process.env.RAZORPAY_KEY_ID)) return "razorpay";
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  return "none";
}

// ✅ Returns billing state for THIS outlet's platform subscription.
// - No subscription configured → mode "none" (app works fully open for launch)
// - Configured → subscription MUST be active to allow ordering
export async function getBilling(): Promise<BillingState> {
  const provider = billingProvider();
  if (provider === "razorpay") return getRazorpayBilling();
  if (provider === "none") return { mode: "none", status: "open" };

  const subId = process.env.BILLING_SUBSCRIPTION_ID || "";
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

  // ✅ STRICT: Stripe IS configured → subscription must be active
  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-08-26.dahlia",
    });
    const sub = await stripe.subscriptions.retrieve(subId);

    const status = sub.status as BillingState["status"];
    // ✅ Fix: current_period_end is a number|string|undefined, handle all cases
    const periodEnd = (sub as any).current_period_end;
    const renewsAt = periodEnd ? Math.floor(Number(periodEnd) * 1000) : undefined;

    // ✅ Active or on trial → allow ordering
    if (status === "active" || status === "trialing") {
      return {
        mode: "enforced",
        status: status,
        renewsAt
      };
    }

    // ✅ STRICT: Any other status (past_due, canceled, unpaid, etc.) → enforced but problematic
    return {
      mode: "enforced",
      status,
      renewsAt,
      // status will be "past_due", "canceled", "unpaid" etc.
    };

  } catch (error) {
    // Stripe error → enforced but unknown
    console.error("Billing check error", error);
    return { mode: "enforced", status: "unknown" };
  }
}

// Razorpay platform subscription check (UPI Autopay e-mandates).
// Uses YOUR platform keys (not the outlet's gateway keys):
// BILLING_RAZORPAY_KEY_ID + BILLING_RAZORPAY_KEY_SECRET.
async function getRazorpayBilling(): Promise<BillingState> {
  const subId = process.env.BILLING_SUBSCRIPTION_ID || "";
  const keyId = process.env.BILLING_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.BILLING_RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
  if (!subId || !keyId || !keySecret) return { mode: "none", status: "open" };

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const r = await fetch(`https://api.razorpay.com/v1/subscriptions/${subId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!r.ok) throw new Error(`razorpay ${r.status}`);
    const sub = (await r.json()) as {
      status?: string;
      current_end?: number | null;
      charge_at?: number | null;
    };
    // Razorpay: active | authenticated | pending | halted | cancelled | completed | expired
    const raw = (sub.status || "").toLowerCase();
    const status: BillingState["status"] =
      raw === "active" || raw === "authenticated"
        ? "active"
        : raw === "pending"
          ? "trialing"
          : raw === "halted"
            ? "past_due"
            : raw === "cancelled" || raw === "completed" || raw === "expired"
              ? "canceled"
              : "unknown";
    const endTs = sub.current_end || sub.charge_at;
    return { mode: "enforced", status, renewsAt: endTs ? endTs * 1000 : undefined };
  } catch (error) {
    console.error("Billing check error", error);
    return { mode: "enforced", status: "unknown" };
  }
}

// ✅ Get Stripe customer portal URL (for billing page)
// Note: Returns null if not configured - the payment-required page handles this
export function getPortalUrl(): string | null {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.BILLING_SUBSCRIPTION_ID) return null;
  // In a full implementation, this would create a Stripe portal session
  // For now, return null and let the UI show a manual update message
  return null;
}

// ✅ Strict gate: true only when billing is configured AND definitely unpaid.
// Unknown (Stripe unreachable) fails OPEN so a Stripe outage never locks
// a paying cafe out mid-service.
export function isBillingBlocked(b: BillingState): boolean {
  return b.mode === "enforced" && (b.status === "past_due" || b.status === "unpaid" || b.status === "canceled");
}

// ---- Subscription plans (per-outlet, via BILLING_PLAN env) ----
// menu     ₹499 — digital menu display only (no ordering, payments, waiter)
// standard ₹699 — menu + ordering + payments + tracking + waiter (most popular)
// pro      ₹1299 — everything: kitchen, coupons, staff, analytics, design
// Unset → "pro" (full access, backward compatible for self-hosted).
export type Plan = "menu" | "standard" | "pro";

export function getPlan(): Plan {
  const p = (process.env.BILLING_PLAN || "").toLowerCase().trim();
  if (p === "menu" || p === "standard" || p === "pro") return p;
  return "pro";
}

// Customer ordering stack (cart, checkout, payments, waiter, coupons).
export function planAllowsOrdering(plan: Plan): boolean {
  return plan === "standard" || plan === "pro";
}

// Pro-only dashboard modules (kitchen, coupons, staff).
export function planAllowsPro(plan: Plan): boolean {
  return plan === "pro";
}