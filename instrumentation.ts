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

let crashGuardsInstalled = false;

type NodeProcessLike = { on(event: string, listener: (arg: unknown) => void): void };

// accessed via globalThis so the Edge bundle never sees a bare `process.on`
function nodeProcess(): NodeProcessLike | null {
  const p = (globalThis as { process?: unknown }).process as NodeProcessLike | undefined;
  return p && typeof p.on === "function" ? p : null;
}

// A single stray rejection inside one request should not take down the whole
// instance while it is serving a burst. Log + report, keep the process alive;
// the failing request still returns its own error to the customer.
function installCrashGuards() {
  if (crashGuardsInstalled) return;
  const proc = nodeProcess();
  if (!proc) return; // edge runtime: nothing to guard here
  crashGuardsInstalled = true;
  proc.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED_REJECTION", reason instanceof Error ? reason.message : reason);
    try { Sentry.captureException(reason); } catch { /* never throw from a guard */ }
  });
  proc.on("uncaughtException", (err) => {
    console.error("UNCAUGHT_EXCEPTION", err instanceof Error ? err.message : err);
    try { Sentry.captureException(err); } catch { /* never throw from a guard */ }
  });
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    warnOnMissingEnv();
    installCrashGuards();
  }
}

// Without this hook Next.js swallows route-handler exceptions before Sentry's
// global handlers ever see them, so real 500s would never show up in the
// dashboard. This is the piece that turns "initialised" into "actually wired".
export const onRequestError = Sentry.captureRequestError;
