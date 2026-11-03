import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Uptime-monitor friendly: GET /api/health → { ok, time, db, sentry, region }
// Point UptimeRobot/BetterStack here once deployed. The `sentry` flag tells you
// whether crash reporting is actually armed in this environment.
export async function GET() {
  const sentry = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      time: new Date().toISOString(),
      db: "up",
      sentry,
      region: process.env.VERCEL_REGION || "local",
    });
  } catch {
    return NextResponse.json({ ok: false, db: "down", sentry }, { status: 500 });
  }
}
