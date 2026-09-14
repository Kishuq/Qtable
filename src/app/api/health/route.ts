import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Uptime-monitor friendly: GET /api/health → { ok, time }
// Point UptimeRobot/BetterStack here once deployed.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
