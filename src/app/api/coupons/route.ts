import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr } from "@/lib/security";

// Owner manages discount coupons: list, create/update, delete.
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const coupons = await db.coupon.findMany({ where: { cafeId: s.cafeId }, orderBy: { code: "asc" } });
  return NextResponse.json({ coupons });
}

const Schema = z.object({
  code: z.string().min(3).max(24),
  pct: z.number().int().min(1).max(90),
  active: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Code (3-24 chars) + 1-90% off required" }, { status: 400 });
  const code = cleanStr(p.data.code, 24).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 3) return NextResponse.json({ error: "Use letters/numbers only" }, { status: 400 });
  const coupon = await db.coupon.upsert({
    where: { cafeId_code: { cafeId: s.cafeId, code } },
    create: { cafeId: s.cafeId, code, pct: p.data.pct, active: p.data.active },
    update: { pct: p.data.pct, active: p.data.active },
  });
  await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "COUPON_SAVED", meta: `${code} ${p.data.pct}%` } });
  return NextResponse.json({ ok: true, coupon });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") || "";
  await db.coupon.deleteMany({ where: { id, cafeId: s.cafeId } });
  return NextResponse.json({ ok: true });
}
