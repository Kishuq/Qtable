import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Owner dashboard: live service requests ("call waiter").
// GET → open + acknowledged calls, newest last.
// PATCH { id, status } → ACKNOWLEDGED | RESOLVED (cafe-scoped, no IDOR).
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const calls = await db.serviceCall.findMany({
    where: { cafeId: s.cafeId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return NextResponse.json({ calls });
}

const Schema = z.object({ id: z.string().min(1).max(64), status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]) });

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const call = await db.serviceCall.findFirst({ where: { id: p.data.id, cafeId: s.cafeId } });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await db.serviceCall.update({ where: { id: call.id }, data: { status: p.data.status } });
  try {
    await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "WAITER_STATUS", meta: `${call.id} ${call.status}->${p.data.status}` } });
  } catch {
    /* audit must never break the flow */
  }
  return NextResponse.json({ ok: true, call: updated });
}
