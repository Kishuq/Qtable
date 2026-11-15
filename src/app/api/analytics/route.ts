import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";

// Short in-memory cache (8s per cafe): the overview polls every 5s, and stats
// barely move within seconds — this cuts ~80% of analytics DB load.
// The browser is also allowed to reuse a response for 3s, so N open dashboards
// do not multiply into N requests per poll tick.
const CACHE_MS = 8000;
const HEADERS = { "Cache-Control": "private, max-age=3, stale-while-revalidate=10" };
const cache = new Map<string, { at: number; data: unknown }>();

export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cafeId = s.cafeId;
  const hit = cache.get(cafeId);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.data, { headers: HEADERS });

  // "Today" follows the cafe clock (IST), not server UTC.
  const { istMidnightUTC } = await import("@/lib/day");
  const since = istMidnightUTC();
  const { isProCafe } = await import("@/lib/billing");

  let pro = false;
  let data;
  try {
    pro = await withDbRetry(() => isProCafe(cafeId), "analytics-plan");
    const [todayOrders, openOrders, payments, topItems, feedbacks, lowItems] = await withDbRetry(
      () => Promise.all([
        // Only the columns the summary needs: a busy outlet can have thousands
        // of rows today, and shipping every column wastes bandwidth + memory.
        db.order.findMany({ where: { cafeId, createdAt: { gte: since }, status: { not: "CANCELLED" } }, select: { total: true } }),
        db.order.count({ where: { cafeId, status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } } }),
        db.payment.findMany({ where: { cafeId, createdAt: { gte: since } }, select: { status: true, amount: true } }),
        // Cafe-scoped: never leak another outlet's sellers into this dashboard.
        db.orderItem.groupBy({ by: ["name"], where: { order: { cafeId } }, _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 5 }),
        db.feedback.findMany({ where: { cafeId }, orderBy: { createdAt: "desc" }, take: 10 }),
        // Low stock (Pro only): tracked items at/below their alert threshold.
        pro
          ? db.menuItem.findMany({ where: { cafeId, stock: { gte: 0 } }, select: { name: true, stock: true, lowAt: true }, orderBy: { stock: "asc" }, take: 20 })
          : Promise.resolve([] as { name: string; stock: number | null; lowAt: number }[]),
      ]),
      "analytics",
    );
    const revenue = todayOrders.reduce((a, o) => a + o.total, 0);
    const paid = payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
    const avgRating = feedbacks.length ? feedbacks.reduce((a, f) => a + f.rating, 0) / feedbacks.length : 0;
    const lowStock = lowItems
      .filter((m) => m.stock !== null && m.stock !== undefined && m.stock <= m.lowAt)
      .map((m) => ({ name: m.name, stock: m.stock as number }));
    data = {
      today: { orders: todayOrders.length, revenue, paid, open: openOrders },
      topItems, feedbacks, avgRating: Math.round(avgRating * 10) / 10, lowStock,
    };
  } catch {
    // Serve the last snapshot rather than a red error card on the dashboard.
    if (hit) return NextResponse.json(hit.data, { headers: HEADERS });
    return NextResponse.json(
      { error: "Stats are temporarily unavailable." },
      { status: 503, headers: { "Retry-After": "5", "Cache-Control": "private, no-store" } },
    );
  }
  cache.set(cafeId, { at: Date.now(), data });
  return NextResponse.json(data, { headers: HEADERS });
}
