import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cafeId = s.cafeId;
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const [todayOrders, openOrders, payments, topItems, feedbacks] = await Promise.all([
    db.order.findMany({ where: { cafeId, createdAt: { gte: since }, status: { not: "CANCELLED" } } }),
    db.order.count({ where: { cafeId, status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } } }),
    db.payment.findMany({ where: { cafeId, createdAt: { gte: since } } }),
    db.orderItem.groupBy({ by: ["name"], _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 5 }),
    db.feedback.findMany({ where: { cafeId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const revenue = todayOrders.reduce((a, o) => a + o.total, 0);
  const paid = payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
  const avgRating = feedbacks.length ? feedbacks.reduce((a, f) => a + f.rating, 0) / feedbacks.length : 0;
  return NextResponse.json({
    today: { orders: todayOrders.length, revenue, paid, open: openOrders },
    topItems, feedbacks, avgRating: Math.round(avgRating * 10) / 10,
  });
}
