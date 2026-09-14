import Stripe from "stripe";

// YOUR revenue, not the cafe's: each cafe deployment can be tied to one of
// your Stripe subscriptions. When configured, the dashboard shows a billing
// banner on past-due/canceled — customers are NEVER blocked mid-service.
// When unconfigured (self-host/dev), everything stays fully open.
export type BillingState = {
  mode: "none" | "enforced";
  status: "open" | "active" | "trialing" | "past_due" | "unpaid" | "canceled" | "unknown";
  renewsAt?: number;
};

let cache: { at: number; state: BillingState } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

export async function getBilling(): Promise<BillingState> {
  const subId = process.env.BILLING_SUBSCRIPTION_ID || "";
  if (!process.env.STRIPE_SECRET_KEY || !subId) return { mode: "none", status: "open" };
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sub = await stripe.subscriptions.retrieve(subId);
    const state: BillingState = {
      mode: "enforced",
      status: (sub.status || "unknown") as BillingState["status"],
      // @ts-expect-error stripe type: current_period_end lives on the subscription
      renewsAt: sub.current_period_end,
    };
    cache = { at: Date.now(), state };
    return state;
  } catch {
    return { mode: "enforced", status: "unknown" };
  }
}

export async function getPortalUrl(host: string, proto: string): Promise<string | null> {
  const customer = process.env.BILLING_CUSTOMER_ID || "";
  if (!process.env.STRIPE_SECRET_KEY || !customer) return null;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${proto}://${host}/dashboard/settings`,
    });
    return session.url;
  } catch {
    return null;
  }
}
