import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr } from "@/lib/security";

async function guard() {
  const s = await getSession();
  if (!s?.cafeId) return null;
  return s;
}

// ✅ Allowed status values for the orders list filter
const ALLOWED_STATUSES = ["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED", "ALL"] as const;

export async function GET(req: NextRequest) {
  const s = await guard();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ Validate and sanitize query parameters
  const status = req.nextUrl.searchParams.get("status") || "";
  // ✅ Only allow known status values; unknown values fallback to showing all
  const safeStatus = ALLOWED_STATUSES.includes(status as any) ? status : "";

  const q = cleanStr(req.nextUrl.searchParams.get("q") || "", 100); // ✅ max 100 chars, sanitized
  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  const history = req.nextUrl.searchParams.get("history") === "1";

  // ✅ Validate date format (YYYY-MM-DD) if provided — prevent injection via date fields
  const gte = from ? ( /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00`) : undefined ) : undefined;
  const lte = to ? ( /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59`) : undefined ) : undefined;

  const createdAt = gte || lte ? { ...(gte && !isNaN(+gte) ? { gte } : {}), ...(lte && !isNaN(+lte) ? { lte } : {}) } : undefined;
  // live=1 is the dashboard heartbeat: NEW orders + open waiter calls in ONE
  // round trip. Previously every owner tab polled /api/orders and /api/waiter
  // separately every 5s — double the requests and double the DB load.
  const live = req.nextUrl.searchParams.get("live") === "1";

  const [orders, waiterCalls] = await Promise.all([
    db.order.findMany({
      where: {
        cafeId: s.cafeId,
        ...(safeStatus && safeStatus !== "ALL" ? { status: safeStatus as string } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(q ? { OR: [{ tableCode: { contains: q } }, { customerName: { contains: q } }, { customerPhone: { contains: q } }] } : {}),
      },
      include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 3 } },
      orderBy: { createdAt: "desc" },
      take: history ? 1000 : live ? 50 : 120,
    }),
    live
      ? db.serviceCall.findMany({
          where: { cafeId: s.cafeId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
          orderBy: { createdAt: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);
  const revenue = orders.filter((o) => o.status !== "CANCELLED").reduce((a, o) => a + o.total, 0);
  return NextResponse.json({ orders, revenue, count: orders.length, ...(live ? { waiterCalls } : {}) });
}
