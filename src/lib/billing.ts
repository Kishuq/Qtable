import Stripe from "stripe";

// Billing state per cafe deployment
export type BillingState = {
  mode: "none" | "enforced"; // "none" = app works fully open, "enforced" = subscription required
  status: "open" | "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "unknown";
  renewsAt?: number; // Unix timestamp (ms) when subscription renews
};

// ✅ Returns billing state based on Stripe configuration
// - No Stripe keys → mode "none" (app works fully open for launch)
// - Stripe configured → subscription MUST be active to allow ordering
export async function getBilling(): Promise<BillingState> {
  const subId = process.env.BILLING_SUBSCRIPTION_ID || "";
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const hasStripe = !!stripeSecretKey;

  // If Stripe not configured at all → mode "none" (app works fully open)
  if (!hasStripe || !subId) return { mode: "none", status: "open" };

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

// ✅ Get Stripe customer portal URL (for billing page)
// Note: Returns null if not configured - the payment-required page handles this
export function getPortalUrl(): string | null {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.BILLING_SUBSCRIPTION_ID) return null;
  // In a full implementation, this would create a Stripe portal session
  // For now, return null and let the UI show a manual update message
  return null;
}