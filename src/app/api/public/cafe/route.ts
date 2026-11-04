import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveCafe } from "@/lib/cafe";
import { getSubscription, isSubscriptionActive, planAllowsOrdering } from "@/lib/billing";

// Public customer menu data for one outlet (no login needed — this is what QR
// scans hit). `?slug=` selects the outlet; no slug falls back to the oldest
// outlet so legacy /t/T1 links keep working. Everything comes from a single
// query, and the result is cached at the edge for a few seconds: a busy
// service costs one database read for hundreds of scans instead of one per phone.
const CACHE = "public, s-maxage=15, stale-while-revalidate=120";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  let cafe;
  try {
    const found = await resolveCafe(slug);
    if (!found) return NextResponse.json({ error: "Outlet not available yet" }, { status: 404 });
    cafe = await db.cafe.findUnique({
      where: { id: found.id },
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

  // What the customer is allowed to do here. An unpaid outlet stays readable
  // (its design is worth previewing) but cannot take orders — the customer
  // view then behaves exactly like the Basic menu-only plan.
  const sub = await getSubscription(cafe.id);
  const active = isSubscriptionActive(sub);
  const tier = sub?.plan ?? "standard";
  const plan = active ? tier : "menu";
  const ordering = active && planAllowsOrdering(tier);

  return NextResponse.json({
    cafe: {
      id: cafe.id,
      slug: cafe.slug,
      name: cafe.name,
      tagline: cafe.tagline,
      description: cafe.description,
      upiId: cafe.upiId,
      logoEmoji: cafe.logoEmoji,
      gstPct: cafe.gstPct,
      currency: cafe.currency,
      onlineProvider,
      theme: { primary: cafe.themePrimary, accent: cafe.themeAccent, bg: cafe.themeBg, bgMode: cafe.themeBgMode, pattern: cafe.themePattern, font: cafe.themeFont, radius: cafe.themeRadius, style: cafe.themeStyle, image: cafe.themeImage, wash: cafe.themeWash },
    },
    categories: cafe.categories,
    items: cafe.items,
    tables: cafe.tables.map((t) => ({ code: t.code, name: t.name })),
    coupons: cafe.coupons.map((c) => ({ code: c.code, pct: c.pct })),
    // The customer view only needs to know whether ordering is enabled — no
    // separate billing call on every scan.
    plan,
    ordering,
  }, { headers: { "Cache-Control": CACHE } });
}
