import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCafe } from "@/lib/cafe";
import { rateLimit, clientKey, tooMany, cleanStr, cleanPhone } from "@/lib/security";
import { z } from "zod";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cafe = await requireCafe();
  if (!cafe) return NextResponse.json({ error: "Outlet not available yet" }, { status: 404 });
  const { id } = await ctx.params;
  const order = await db.order.findUnique({ where: { id, cafeId: cafe.id }, include: { items: true, cafe: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  // Queue depth → ETA: orders ahead of this one still in the kitchen pipeline.
  // Base 8 min + 4 min per order ahead, capped at 45. Ready/served/completed → 0.
  let queueAhead = 0;
  try {
    queueAhead = await db.order.count({
      where: {
        cafeId: cafe.id,
        status: { in: ["NEW", "ACCEPTED", "PREPARING"] },
        createdAt: { lt: order.createdAt },
      },
    });
  } catch {
    queueAhead = 0;
  }
  const done = ["READY", "SERVED", "COMPLETED"].includes(order.status);
  const etaMinutes = done || order.status === "CANCELLED" ? 0 : Math.min(45, 8 + queueAhead * 4);
  return NextResponse.json({
    order: {
      id: order.id, tokenNo: order.tokenNo, status: order.status, total: order.total, subtotal: order.subtotal,
      discount: order.discount, tax: order.tax, tableCode: order.tableCode, paymentMode: order.paymentMode,
      paymentStatus: order.paymentStatus, customerName: order.customerName, createdAt: order.createdAt,
      cafeName: order.cafe.name, upiId: order.cafe.upiId, currency: order.cafe.currency,
      queueAhead, etaMinutes,
      theme: { primary: order.cafe.themePrimary, accent: order.cafe.themeAccent, bg: order.cafe.themeBg, bgMode: order.cafe.themeBgMode, pattern: order.cafe.themeFont, font: order.cafe.themeFont, radius: order.cafe.themeRadius },
      items: order.items,
    },
  });
}

const PaySchema = z.object({ upiRef: z.string().max(64).optional().default("") });

// Customer confirms "I paid via UPI" — owner verifies on dashboard before marking PAID.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const cafe = await requireCafe();
  if (!cafe) return NextResponse.json({ error: "Outlet not available yet" }, { status: 404 });
  if (!rateLimit(clientKey(req, "pay-claim"), 20, 60_000)) return tooMany();
  const { id } = await ctx.params;
  let body: unknown = {};
  try { body = await req.json(); } catch { body = {}; }
  const parsed = PaySchema.safeParse(body);
  const upiRef = parsed.success ? cleanStr(parsed.data.upiRef, 64) : "";
  const order = await db.order.findUnique({ where: { id, cafeId: cafe.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  await db.payment.create({ data: { cafeId: cafe.id, orderId: order.id, mode: "UPI", status: "PENDING", amount: order.total, providerRef: cleanPhone(upiRef) || upiRef } });
  await db.auditLog.create({ data: { cafeId: cafe.id, action: "UPI_CLAIMED", meta: `${order.id} ref=${upiRef}` } });
  return NextResponse.json({ ok: true });
}