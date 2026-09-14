import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr } from "@/lib/security";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tables = await db.cafeTable.findMany({ where: { cafeId: s.cafeId }, orderBy: { code: "asc" } });
  const cafe = await db.cafe.findUnique({ where: { id: s.cafeId } });
  // Host-aware: QRs encode the same address the owner opened the dashboard from
  // (localhost on PC, LAN IP on phone, public domain in production).
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || ((process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https") ? "https" : "http");
  return NextResponse.json({ tables, slug: cafe?.slug, appUrl: `${proto}://${host}` });
}

const Schema = z.object({ code: z.string().min(1).max(12), name: z.string().max(40).optional().default("") });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  const code = cleanStr(p.data.code, 12).toUpperCase();
  try {
    const t = await db.cafeTable.create({ data: { cafeId: s.cafeId, code, name: cleanStr(p.data.name, 40) || `Table ${code}` } });
    return NextResponse.json({ ok: true, table: t });
  } catch {
    return NextResponse.json({ error: "Table code already exists" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  await db.cafeTable.deleteMany({ where: { id, cafeId: s.cafeId } });
  return NextResponse.json({ ok: true });
}
