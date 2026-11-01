import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr } from "@/lib/security";

// ✅ Simple URL validator — https URLs, or a built-in DB photo path (no storage account needed)
function photoIdFromUrl(v: string): string {
  const m = /^\/api\/public\/photo\/([a-z0-9]+)$/i.exec(v);
  return m ? m[1] : "";
}
function isValidImageUrl(v: string): boolean {
  if (photoIdFromUrl(v)) return true;
  try {
    new URL(v);
    return v.startsWith("http://") || v.startsWith("https://");
  } catch {
    return false;
  }
}

// Best-effort cleanup: remove a stored photo once no menu item points at it.
async function dropPhoto(id: string, cafeId: string) {
  if (!id) return;
  const still = await db.menuItem.count({ where: { cafeId, imageUrl: `/api/public/photo/${id}` } });
  if (still === 0) await db.menuPhoto.deleteMany({ where: { id, cafeId } }).catch(() => {});
}

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
  // Inventory (Pro only): stock null = untracked, otherwise live count.
  stock: z.number().int().min(0).max(1000000).nullable().optional(),
  lowAt: z.number().int().min(0).max(1000000).optional(),
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
  const photo = isValidImageUrl(d.imageUrl) ? d.imageUrl : "";
  // Editing must stay inside the caller's outlet (no cross-cafe ID access).
  const prev = d.id
    ? await db.menuItem.findFirst({ where: { id: d.id, cafeId: s.cafeId }, select: { imageUrl: true } })
    : null;
  if (d.id && !prev) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  // Stock fields are Pro-only — stripped on lower plans so crafted requests can't enable them.
  const { getPlan, planAllowsPro } = await import("@/lib/billing");
  const pro = planAllowsPro(getPlan());
  const stockData = pro
    ? { stock: d.stock === undefined ? undefined : d.stock, lowAt: d.lowAt === undefined ? undefined : d.lowAt }
    : {};
  const item = d.id
    ? await db.menuItem.update({ where: { id: d.id }, data: { categoryId: d.categoryId || null, name: cleanStr(d.name, 80), description: cleanStr(d.description, 300), price: d.price, imageEmoji: cleanStr(d.imageEmoji, 12) || "🍽️", imageUrl: photo, veg: d.veg, available: d.available, popular: d.popular, ...stockData } })
    : await db.menuItem.create({ data: { cafeId: s.cafeId!, categoryId: d.categoryId || null, name: cleanStr(d.name, 80), description: cleanStr(d.description, 300), price: d.price, imageEmoji: cleanStr(d.imageEmoji, 12) || "🍽️", imageUrl: photo, veg: d.veg, available: d.available, popular: d.popular, sort: count, ...stockData } });
  // Free database-stored photos that this edit replaced.
  const oldPhoto = photoIdFromUrl(prev?.imageUrl || "");
  if (oldPhoto && oldPhoto !== photoIdFromUrl(photo)) await dropPhoto(oldPhoto, s.cafeId);
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const item = await db.menuItem.findFirst({ where: { id, cafeId: s.cafeId }, select: { imageUrl: true } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  await db.menuItem.delete({ where: { id } });
  await dropPhoto(photoIdFromUrl(item.imageUrl), s.cafeId);
  return NextResponse.json({ ok: true });
}
