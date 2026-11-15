import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";

// Uptime-monitor friendly: GET /api/health
// Point UptimeRobot/BetterStack here. Boolean flags tell you which production
// integrations are actually armed in THIS environment (never expose secrets).
// The endpoint stays public but reveals nothing an attacker can use.
export async function GET() {
  const started = Date.now();
  const flags = {
    sentry: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    billing: Boolean(process.env.BILLING_RAZORPAY_KEY_ID && process.env.BILLING_RAZORPAY_KEY_SECRET),
    webhook: Boolean(process.env.BILLING_RAZORPAY_WEBHOOK_SECRET),
    email: Boolean(process.env.RESEND_API_KEY),
    redis: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    cron: Boolean(process.env.CRON_SECRET),
    admin: Boolean(process.env.ADMIN_EMAILS),
  };
  const version =
    (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) ||
    process.env.npm_package_version ||
    "dev";

  try {
    // One retry absorbs a paused Neon compute waking up. An uptime monitor
    // should not page anyone because the database took a second to resume.
    await withDbRetry(() => db.$queryRaw`SELECT 1`, "health", 2);
    return NextResponse.json({
      ok: true,
      time: new Date().toISOString(),
      db: "up",
      dbMs: Date.now() - started,
      sentry: flags.sentry,
      integrations: flags,
      version,
      region: process.env.VERCEL_REGION || "local",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", sentry: flags.sentry, integrations: flags, version },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
