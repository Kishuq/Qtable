import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isEmail, rateLimit, clientKey, tooMany, cleanStr } from "@/lib/security";

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
  const orders = await db.order.findMany({
    where: {
      cafeId: s.cafeId,
      ...(safeStatus && safeStatus !== "ALL" ? { status: safeStatus as string } : {}),
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
