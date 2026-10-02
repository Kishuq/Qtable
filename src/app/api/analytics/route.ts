import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Short in-memory cache (8s per cafe): the overview polls every 5s, and stats
// barely move within seconds — this cuts ~80% of analytics DB load.
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 8000;

export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cafeId = s.cafeId;
  const hit = cache.get(cafeId);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.data);

  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { getPlan, planAllowsPro } = await import("@/lib/billing");
  const pro = planAllowsPro(getPlan());
  const [todayOrders, openOrders, payments, topItems, feedbacks, lowItems] = await Promise.all([
    db.order.findMany({ where: { cafeId, createdAt: { gte: since }, status: { not: "CANCELLED" } } }),
    db.order.count({ where: { cafeId, status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } } }),
    db.payment.findMany({ where: { cafeId, createdAt: { gte: since } } }),
    // Cafe-scoped: never leak another outlet's sellers into this dashboard.
    db.orderItem.groupBy({ by: ["name"], where: { order: { cafeId } }, _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 5 }),
    db.feedback.findMany({ where: { cafeId }, orderBy: { createdAt: "desc" }, take: 10 }),
    // Low stock (Pro only): tracked items at/below their alert threshold.
    pro
      ? db.menuItem.findMany({ where: { cafeId, stock: { gte: 0 } }, select: { name: true, stock: true, lowAt: true }, orderBy: { stock: "asc" }, take: 20 })
      : Promise.resolve([] as { name: string; stock: number | null; lowAt: number }[]),
  ]);
  const revenue = todayOrders.reduce((a, o) => a + o.total, 0);
  const paid = payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
  const avgRating = feedbacks.length ? feedbacks.reduce((a, f) => a + f.rating, 0) / feedbacks.length : 0;
  const lowStock = lowItems
    .filter((m) => m.stock !== null && m.stock !== undefined && m.stock <= m.lowAt)
    .map((m) => ({ name: m.name, stock: m.stock as number }));
  const data = {
    today: { orders: todayOrders.length, revenue, paid, open: openOrders },
    topItems, feedbacks, avgRating: Math.round(avgRating * 10) / 10, lowStock,
  };
  cache.set(cafeId, { at: Date.now(), data });
  return NextResponse.json(data);
}
