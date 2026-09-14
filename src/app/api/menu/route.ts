import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr } from "@/lib/security";

export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [categories, items] = await Promise.all([
    db.category.findMany({ where: { cafeId: s.cafeId }, orderBy: { sort: "asc" } }),
    db.menuItem.findMany({ where: { cafeId: s.cafeId }, orderBy: { sort: "asc" } }),
  ]);
  return NextResponse.json({ categories, items });
}

const Upsert = z.object({
  id: z.string().max(64).optional().default(""),
  categoryId: z.string().max(64).optional().default(""),
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional().default(""),
  price: z.number().int().min(100).max(10000000), // paise
  imageEmoji: z.string().max(12).optional().default("🍽️"),
  imageUrl: z.string().max(500).optional().default(""),
  veg: z.boolean().optional().default(true),
  available: z.boolean().optional().default(true),
  popular: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Upsert.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  const d = p.data;
  if (d.categoryId) {
    const c = await db.category.findFirst({ where: { id: d.categoryId, cafeId: s.cafeId } });
    if (!c) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  const count = await db.menuItem.count({ where: { cafeId: s.cafeId } });
  const photo = cleanStr(d.imageUrl, 500).startsWith("http") ? cleanStr(d.imageUrl, 500) : "";
  const item = d.id
    ? await db.menuItem.update({ where: { id: d.id }, data: { categoryId: d.categoryId || null, name: cleanStr(d.name, 80), description: cleanStr(d.description, 300), price: d.price, imageEmoji: cleanStr(d.imageEmoji, 12) || "🍽️", imageUrl: photo, veg: d.veg, available: d.available, popular: d.popular } })
    : await db.menuItem.create({ data: { cafeId: s.cafeId!, categoryId: d.categoryId || null, name: cleanStr(d.name, 80), description: cleanStr(d.description, 300), price: d.price, imageEmoji: cleanStr(d.imageEmoji, 12) || "🍽️", imageUrl: photo, veg: d.veg, available: d.available, popular: d.popular, sort: count } });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.menuItem.deleteMany({ where: { id, cafeId: s.cafeId } });
  return NextResponse.json({ ok: true });
}
