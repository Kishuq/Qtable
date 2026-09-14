import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr } from "@/lib/security";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = cleanStr((body as { name?: string })?.name || "", 40);
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const count = await db.category.count({ where: { cafeId: s.cafeId } });
  const c = await db.category.create({ data: { cafeId: s.cafeId, name, sort: count } });
  return NextResponse.json({ ok: true, category: c });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  await db.category.deleteMany({ where: { id, cafeId: s.cafeId } });
  return NextResponse.json({ ok: true });
}
