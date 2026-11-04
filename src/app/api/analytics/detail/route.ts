import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlan, planAllowsPro } from "@/lib/billing";
import { istMidnightUTC, tokenDayIST } from "@/lib/day";

// Insights is a Pro module. A short cache keeps a dashboard left open on a
// counter screen from hammering Postgres — aggregates barely move in 15s.
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 15_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!planAllowsPro(getPlan())) {
    return NextResponse.json({ error: "Insights is a Pro feature", pro: false }, { status: 403 });
  }

  const days = Math.min(30, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 7));
  const key = `${s.cafeId}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.data);

  const todayStart = istMidnightUTC();
  const since = new Date(todayStart.getTime() - (days - 1) * DAY_MS);

  const [orders, payments, topItems, feedbacks] = await Promise.all([
    db.order.findMany({
      where: { cafeId: s.cafeId, createdAt: { gte: since }, status: { not: "CANCELLED" } },
      select: { total: true, createdAt: true, paymentMode: true, status: true, tableCode: true },
    }),
    db.payment.findMany({
      where: { cafeId: s.cafeId, createdAt: { gte: since }, status: "PAID" },
      select: { amount: true, mode: true },
    }),
    db.orderItem.groupBy({
      by: ["name"],
      where: { order: { cafeId: s.cafeId, createdAt: { gte: since }, status: { not: "CANCELLED" } } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 8,
    }),
    db.feedback.findMany({ where: { cafeId: s.cafeId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  // ---- Daily buckets, aligned to IST midnight so "today" matches the café ----
  const daily: { day: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = 0; i < days; i++) {
    const dayKey = tokenDayIST(new Date(since.getTime() + i * DAY_MS));
    daily.push({
      day: dayKey,
      label: new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
      revenue: 0,
      orders: 0,
    });
  }
  const byDay = new Map(daily.map((d) => [d.day, d]));

  // ---- Hourly heat (IST) — 24 fixed buckets ----
  const hourly = Array.from({ length: 24 }, () => 0);

  for (const o of orders) {
    const bucket = byDay.get(tokenDayIST(o.createdAt));
    if (bucket) {
      bucket.revenue += o.total;
      bucket.orders += 1;
    }
    const istHour = new Date(o.createdAt.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
    hourly[istHour] += 1;
  }

  const revenue = orders.reduce((a, o) => a + o.total, 0);
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  const modes = { COUNTER: 0, UPI: 0, ONLINE: 0 };
  for (const o of orders) {
    const m = o.paymentMode === "UPI" ? "UPI" : o.paymentMode === "ONLINE" ? "ONLINE" : "COUNTER";
    modes[m] += 1;
  }
  const peakHour = hourly.indexOf(Math.max(...hourly));
  const avgRating = feedbacks.length ? feedbacks.reduce((a, f) => a + f.rating, 0) / feedbacks.length : 0;

  const data = {
    days,
    totals: {
      revenue,
      orders: orders.length,
      avgTicket: orders.length ? Math.round(revenue / orders.length) : 0,
      paid,
      unpaid: Math.max(0, revenue - paid),
      avgRating: Math.round(avgRating * 10) / 10,
      feedbackCount: feedbacks.length,
      peakHour: orders.length ? peakHour : null,
    },
    daily,
    hourly,
    modes,
    topItems: topItems.map((t) => ({ name: t.name, qty: t._sum.qty || 0 })),
    feedbacks: feedbacks.map((f) => ({ id: f.id, rating: f.rating, comment: f.comment, createdAt: f.createdAt })),
  };

  cache.set(key, { at: Date.now(), data });
  return NextResponse.json(data);
}
