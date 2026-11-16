import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db, withDbRetry } from "@/lib/db";
import { isValidSlug } from "@/lib/cafe";
import { subscriptionFromCafe, isSubscriptionActive, planAllowsOrdering } from "@/lib/billing";

// Public customer menu data for one outlet (no login needed — this is what QR
// scans hit). `?slug=` selects the outlet; no slug falls back to the oldest
// outlet so legacy /t/T1 links keep working.
//
// Capacity model, in three layers:
//   1. Edge cache (15s + 2 min stale-while-revalidate) — absorbs the crowd.
//   2. Per-instance micro-cache (3s) + in-flight coalescing — if 500 requests
//      land on the same lambda in the same instant, exactly ONE queries the
//      database and the rest await that same promise.
//   3. Last-known-good snapshot (10 min) — if the DB is unreachable when the
//      cache is cold, customers still get the menu instead of an error.
const CACHE = "public, s-maxage=15, stale-while-revalidate=120";
const NOT_FOUND_CACHE = "public, s-maxage=10";
const MICRO_MS = 3000;
const GOOD_TTL_MS = 10 * 60_000;
const GOOD_MAX_ENTRIES = 300;

const micro = new Map<string, { at: number; text: string }>();
const lastGood = new Map<string, { text: string; at: number }>();
const inFlight = new Map<string, Promise<MenuResult>>();

type MenuResult =
  | { kind: "ok"; text: string }
  | { kind: "missing"; text: string }
  | { kind: "error" };

// The JSON is serialized once per cache fill, not once per request. At 1,000
// simultaneous scans this removes 1,000 stringify passes over the menu body —
// the single largest CPU cost of answering from the micro-cache.
function remember(key: string, text: string) {
  if (lastGood.size >= GOOD_MAX_ENTRIES) {
    const oldest = lastGood.keys().next().value;
    if (oldest) lastGood.delete(oldest);
  }
  lastGood.set(key, { text, at: Date.now() });
}

const json = (text: string, headers: Record<string, string>, status = 200) =>
  new NextResponse(text, { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });

const menuInclude: Prisma.CafeInclude = {
  categories: { orderBy: { sort: "asc" } },
  items: { where: { available: true, OR: [{ stock: null }, { stock: { gt: 0 } }] }, orderBy: { sort: "asc" } },
  tables: { where: { active: true }, orderBy: { code: "asc" } },
  coupons: { where: { active: true } },
};

async function loadMenu(slug: string): Promise<MenuResult> {
  try {
    const cafe = await withDbRetry(
      () =>
        slug
          ? db.cafe.findUnique({ where: { slug }, include: menuInclude })
          : db.cafe.findFirst({ orderBy: { createdAt: "asc" }, include: menuInclude }),
      "public-cafe",
    );
    if (!cafe || !cafe.isActive) return { kind: "missing", text: NOT_FOUND_TEXT };

    // Gateway comes from the outlet's self-serve config first, deployment env second.
    const hasCf = Boolean(cafe.cashfreeAppId || process.env.CASHFREE_APP_ID);
    const onlineProvider = hasCf ? "cashfree" : process.env.STRIPE_SECRET_KEY ? "stripe" : null;

    // Subscription columns came back with the cafe row — no second query.
    const sub = subscriptionFromCafe(cafe);
    const active = isSubscriptionActive(sub);
    const tier = sub.plan;
    // What the customer is allowed to do here. An unpaid outlet stays readable
    // (its design is worth previewing) but cannot take orders — the customer
    // view then behaves exactly like the Basic menu-only plan.
    const plan = active ? tier : "menu";
    const ordering = active && planAllowsOrdering(tier);

    return {
      kind: "ok",
      text: JSON.stringify({
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
        // Unpaid outlet: show "setting up" instead of "menu-only plan".
        preview: !active,
      }),
    };
  } catch (e) {
    console.error("PUBLIC_CAFE_DB_FAIL", e instanceof Error ? e.message : e);
    return { kind: "error" };
  }
}

const NOT_FOUND_TEXT = JSON.stringify({ error: "Outlet not available yet" });

export async function GET(req: NextRequest) {
  const rawSlug = (req.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
  if (rawSlug && !isValidSlug(rawSlug)) {
    return json(NOT_FOUND_TEXT, { "Cache-Control": NOT_FOUND_CACHE }, 404);
  }
  const key = rawSlug || "__oldest";

  // Layer 2a: micro-cache — a few seconds of identical answers per instance.
  const hit = micro.get(key);
  if (hit && Date.now() - hit.at < MICRO_MS) {
    return json(hit.text, {
      "Cache-Control": hit.text === NOT_FOUND_TEXT ? NOT_FOUND_CACHE : CACHE,
      "X-Qtable-Cache": "hit",
    }, hit.text === NOT_FOUND_TEXT ? 404 : 200);
  }

  // Layer 2b: coalesce concurrent loads of the same outlet into one query.
  let pending = inFlight.get(key);
  if (!pending) {
    pending = loadMenu(rawSlug).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  const result = await pending;

  if (result.kind === "ok") {
    micro.set(key, { at: Date.now(), text: result.text });
    remember(key, result.text);
    return json(result.text, { "Cache-Control": CACHE });
  }

  if (result.kind === "missing") {
    // Cache the negative answer too: slug-enumeration bursts should not turn
    // into one database query per request on the same instance.
    micro.set(key, { at: Date.now(), text: result.text });
    return json(result.text, { "Cache-Control": NOT_FOUND_CACHE }, 404);
  }

  // Layer 3: database unreachable after retries. Serve what this instance last
  // saw rather than telling a paying customer the restaurant doesn't exist.
  const snap = lastGood.get(key);
  if (snap && Date.now() - snap.at < GOOD_TTL_MS) {
    return json(snap.text, {
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=300",
      "X-Qtable-Cache": "stale",
      "Retry-After": "5",
    });
  }
  return json(
    JSON.stringify({ error: "Menu is temporarily unavailable. Please refresh in a moment." }),
    { "Retry-After": "5", "Cache-Control": "no-store" },
    503,
  );
}
