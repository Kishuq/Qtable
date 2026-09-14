import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ORDER_STATUSES, nextStatuses } from "@/lib/security";

const Schema = z.object({ status: z.enum(["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"]), paymentStatus: z.enum(["PENDING", "PAID", "FAILED"]).optional() });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success || !ORDER_STATUSES.includes(p.data.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const order = await db.order.findFirst({ where: { id, cafeId: s.cafeId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Enforce legal transitions (owner/staff can still cancel from NEW/ACCEPTED/PREPARING)
  const allowed = nextStatuses(order.status);
  const isCancel = p.data.status === "CANCELLED";
  if (order.status !== p.data.status && !allowed.includes(p.data.status) && !(isCancel && ["NEW", "ACCEPTED", "PREPARING"].includes(order.status))) {
    return NextResponse.json({ error: `Cannot move ${order.status} → ${p.data.status}` }, { status: 400 });
  }
  const updated = await db.order.update({
    where: { id },
    data: { status: p.data.status, ...(p.data.paymentStatus ? { paymentStatus: p.data.paymentStatus } : {}), ...(p.data.paymentStatus === "PAID" ? {} : {}) },
  });
  if (p.data.paymentStatus === "PAID") {
    await db.payment.updateMany({ where: { orderId: id, status: "PENDING" }, data: { status: "PAID" } });
  }
  await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "ORDER_STATUS", meta: `${id} ${order.status}->${p.data.status}` } });
  return NextResponse.json({ ok: true, order: updated });
}
