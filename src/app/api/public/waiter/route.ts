import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCafe } from "@/lib/cafe";
import { rateLimit, clientKey, tooMany, cleanStr } from "@/lib/security";

const Schema = z.object({ tableCode: z.string().min(1).max(12) });

// Customer taps "Call Waiter" — creates a service request for the counter.
// Cooldown: one open request per table per 3 minutes (prevents spam-tapping).
export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "waiter"), 5, 60_000)) return tooMany();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid table" }, { status: 400 });

  let cafe;
  try {
    cafe = await requireCafe();
  } catch {
    return NextResponse.json({ error: "Cafe unavailable" }, { status: 404 });
  }
  if (!cafe.isActive) return NextResponse.json({ error: "Cafe unavailable" }, { status: 404 });

  const tableCode = cleanStr(p.data.tableCode, 12).toUpperCase();
  const table = await db.cafeTable.findFirst({ where: { cafeId: cafe.id, code: tableCode, active: true } });
  if (!table) return NextResponse.json({ error: "Invalid table. Please re-scan the QR." }, { status: 400 });

  try {
    const { getBilling, isBillingBlocked } = await import("@/lib/billing");
    if (isBillingBlocked(await getBilling())) {
      return NextResponse.json({ error: "This cafe's subscription is paused — please contact the counter." }, { status: 402 });
    }
  } catch {
    // billing check itself failed → fail open
  }

  const recent = await db.serviceCall.findFirst({
    where: { cafeId: cafe.id, tableCode, status: "OPEN", createdAt: { gte: new Date(Date.now() - 3 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return NextResponse.json({ ok: true, duplicate: true });

  const call = await db.serviceCall.create({ data: { cafeId: cafe.id, tableCode } });
  try {
    await db.auditLog.create({ data: { cafeId: cafe.id, action: "WAITER_CALLED", meta: `${call.id} ${tableCode}` } });
  } catch {
    /* audit must never break the call */
  }
  return NextResponse.json({ ok: true });
}
