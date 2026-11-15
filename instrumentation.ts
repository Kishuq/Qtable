// Registers Sentry on the server. No-op without SENTRY_DSN.
import * as Sentry from "@sentry/nextjs";

// Production config sanity check. Logged once per cold start (never throws):
// missing billing keys break revenue, a missing JWT_SECRET breaks every session
// on redeploy, and a missing CRON_SECRET silently disables renewals.
function warnOnMissingEnv() {
  if (process.env.NODE_ENV !== "production") return;
  const required: { key: string; why: string }[] = [
    { key: "DATABASE_URL", why: "no database" },
    { key: "JWT_SECRET", why: "sessions break on every cold start" },
    { key: "NEXT_PUBLIC_APP_URL", why: "QR links and receipts use a fallback host" },
    { key: "BILLING_RAZORPAY_KEY_ID", why: "self-serve checkout disabled" },
    { key: "BILLING_RAZORPAY_KEY_SECRET", why: "self-serve checkout disabled" },
    { key: "BILLING_RAZORPAY_WEBHOOK_SECRET", why: "payment webhooks rejected" },
    { key: "CRON_SECRET", why: "renewal/expiry cron rejects every run" },
    { key: "RESEND_API_KEY", why: "receipts and reminders are not emailed" },
    { key: "ADMIN_EMAILS", why: "no platform console operator configured" },
  ];
  const missing = required.filter((r) => !process.env[r.key]);
  const optional = [
    { key: "UPSTASH_REDIS_REST_URL", why: "rate limits fall back to per-instance memory" },
    { key: "PAYMENT_SECRET", why: "self-serve gateway secrets use JWT_SECRET" },
  ].filter((r) => !process.env[r.key]);
  if (missing.length) {
    console.warn(`[qtable] Missing production env: ${missing.map((m) => `${m.key} (${m.why})`).join("; ")}`);
  }
  if (optional.length) {
    console.warn(`[qtable] Optional env not set: ${optional.map((m) => `${m.key} (${m.why})`).join("; ")}`);
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    warnOnMissingEnv();
  }
}

// Without this hook Next.js swallows route-handler exceptions before Sentry's
// global handlers ever see them, so real 500s would never show up in the
// dashboard. This is the piece that turns "initialised" into "actually wired".
export const onRequestError = Sentry.captureRequestError;
