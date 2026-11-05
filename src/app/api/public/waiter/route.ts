import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCafe } from "@/lib/cafe";
import { orderingBlockedReason } from "@/lib/billing";
import { limitTenantRequest, tooMany, cleanStr } from "@/lib/security";

const Schema = z.object({
  tableCode: z.string().min(1).max(12),
  slug: z.string().max(60).optional().default(""),
});

// Customer taps "Call Waiter" — creates a service request for the counter.
// Cooldown: one open request per table per 3 minutes (prevents spam-tapping).
export async function POST(req: NextRequest) {
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
    cafe = await requireCafe(p.data.slug);
  } catch {
    return NextResponse.json({ error: "Outlet unavailable" }, { status: 404 });
  }
  if (!cafe.isActive) return NextResponse.json({ error: "Outlet unavailable" }, { status: 404 });
  // Per-outlet budget so a busy café doesn't silence its neighbours' calls.
  if (!(await limitTenantRequest(req, "waiter", cafe.slug, 5, 60_000))) return tooMany();

  const tableCode = cleanStr(p.data.tableCode, 12).toUpperCase();
  const table = await db.cafeTable.findFirst({ where: { cafeId: cafe.id, code: tableCode, active: true } });
  if (!table) return NextResponse.json({ error: "Invalid table. Please re-scan the QR." }, { status: 400 });

  const blocked = await orderingBlockedReason(cafe.id);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 402 });

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
