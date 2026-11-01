import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing";

// Public customer menu data for THE cafe (no login needed — this is what QR
// scans hit). Everything comes from a single query, and the result is cached
// at the edge for a few seconds: a busy service costs one database read for
// hundreds of scans instead of one per phone.
const CACHE = "public, s-maxage=15, stale-while-revalidate=120";

export async function GET() {
  let cafe;
  try {
    cafe = await db.cafe.findFirst({
      orderBy: { createdAt: "asc" },
      include: {
        categories: { orderBy: { sort: "asc" } },
        items: { where: { available: true, OR: [{ stock: null }, { stock: { gt: 0 } }] }, orderBy: { sort: "asc" } },
        tables: { where: { active: true }, orderBy: { code: "asc" } },
        coupons: { where: { active: true } },
      },
    });
  } catch {
    return NextResponse.json({ error: "Outlet not available yet" }, { status: 404 });
  }
  if (!cafe || !cafe.isActive) return NextResponse.json({ error: "Outlet not available yet" }, { status: 404 });

  // Gateway comes from the outlet's self-serve config first, deployment env second.
  const hasRzp = Boolean(cafe.razorpayKeySecretEnc || process.env.RAZORPAY_KEY_ID);
  const onlineProvider = hasRzp ? "razorpay" : process.env.STRIPE_SECRET_KEY ? "stripe" : null;
  return NextResponse.json({
    cafe: { id: cafe.id, name: cafe.name, tagline: cafe.tagline, description: cafe.description, upiId: cafe.upiId, logoEmoji: cafe.logoEmoji, gstPct: cafe.gstPct, currency: cafe.currency,
      onlineProvider,
      theme: { primary: cafe.themePrimary, accent: cafe.themeAccent, bg: cafe.themeBg, bgMode: cafe.themeBgMode, pattern: cafe.themePattern, font: cafe.themeFont, radius: cafe.themeRadius, style: cafe.themeStyle, image: cafe.themeImage, wash: cafe.themeWash } },
    categories: cafe.categories,
    items: cafe.items,
    tables: cafe.tables.map((t) => ({ code: t.code, name: t.name })),
    coupons: cafe.coupons.map((c) => ({ code: c.code, pct: c.pct })),
    // The customer view only needs to know whether ordering is enabled — no
    // separate billing call (which can reach Stripe/Razorpay) on every scan.
    plan: getPlan(),
  }, { headers: { "Cache-Control": CACHE } });
}
