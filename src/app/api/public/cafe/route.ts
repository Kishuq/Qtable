import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCafe } from "@/lib/cafe";

// Public customer menu data for THE cafe (no login needed — this is what QR scans hit).
export async function GET() {
  let cafeId: string;
  try { cafeId = (await requireCafe()).id; } catch { return NextResponse.json({ error: "Cafe not available yet" }, { status: 404 }); }
  const cafe = await db.cafe.findUnique({
    where: { id: cafeId },
    include: { categories: { orderBy: { sort: "asc" } }, items: { where: { available: true }, orderBy: { sort: "asc" } }, tables: { where: { active: true }, orderBy: { code: "asc" } } },
  });
  if (!cafe || !cafe.isActive) return NextResponse.json({ error: "Cafe not available yet" }, { status: 404 });
  const coupons = await db.coupon.findMany({ where: { cafeId: cafe.id, active: true } });
  return NextResponse.json({
    cafe: { id: cafe.id, name: cafe.name, tagline: cafe.tagline, description: cafe.description, upiId: cafe.upiId, logoEmoji: cafe.logoEmoji, gstPct: cafe.gstPct, currency: cafe.currency,
      onlineProvider: process.env.RAZORPAY_KEY_ID ? "razorpay" : process.env.STRIPE_SECRET_KEY ? "stripe" : null,
      theme: { primary: cafe.themePrimary, accent: cafe.themeAccent, bg: cafe.themeBg, bgMode: cafe.themeBgMode, pattern: cafe.themePattern, font: cafe.themeFont, radius: cafe.themeRadius } },
    categories: cafe.categories,
    items: cafe.items,
    tables: cafe.tables.map((t) => ({ code: t.code, name: t.name })),
    coupons: coupons.map((c) => ({ code: c.code, pct: c.pct })),
  });
}
