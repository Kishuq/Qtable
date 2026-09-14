import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

async function guard() {
  const s = await getSession();
  if (!s?.cafeId) return null;
  return s;
}

export async function GET(req: NextRequest) {
  const s = await guard();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") || "";
  const q = req.nextUrl.searchParams.get("q") || "";
  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  const history = req.nextUrl.searchParams.get("history") === "1";
  const gte = from ? new Date(`${from}T00:00:00`) : undefined;
  const lte = to ? new Date(`${to}T23:59:59`) : undefined;
  const createdAt = gte || lte ? { ...(gte && !isNaN(+gte) ? { gte } : {}), ...(lte && !isNaN(+lte) ? { lte } : {}) } : undefined;
  const orders = await db.order.findMany({
    where: {
      cafeId: s.cafeId,
      ...(status && status !== "ALL" ? { status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(q ? { OR: [{ tableCode: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] } : {}),
    },
    include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 3 } },
    orderBy: { createdAt: "desc" },
    take: history ? 1000 : 120,
  });
  const revenue = orders.filter((o) => o.status !== "CANCELLED").reduce((a, o) => a + o.total, 0);
  return NextResponse.json({ orders, revenue, count: orders.length });
}
