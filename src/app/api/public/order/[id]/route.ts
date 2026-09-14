import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { cleanStr, cleanPhone, rateLimit, clientKey, tooMany } from "@/lib/security";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true, cafe: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({
    order: {
      id: order.id, tokenNo: order.tokenNo, status: order.status, total: order.total, subtotal: order.subtotal,
      discount: order.discount, tax: order.tax, tableCode: order.tableCode, paymentMode: order.paymentMode,
      paymentStatus: order.paymentStatus, customerName: order.customerName, createdAt: order.createdAt,
      cafeName: order.cafe.name, upiId: order.cafe.upiId, currency: order.cafe.currency,
      theme: { primary: order.cafe.themePrimary, accent: order.cafe.themeAccent, bg: order.cafe.themeBg, bgMode: order.cafe.themeBgMode, pattern: order.cafe.themePattern, font: order.cafe.themeFont, radius: order.cafe.themeRadius },
      items: order.items,
    },
  });
}

const PaySchema = z.object({ upiRef: z.string().max(64).optional().default("") });

// Customer confirms "I paid via UPI" — owner verifies on dashboard before marking PAID.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!rateLimit(clientKey(req, "pay-claim"), 20, 60_000)) return tooMany();
  const { id } = await ctx.params;
  let body: unknown = {};
  try { body = await req.json(); } catch { body = {}; }
  const parsed = PaySchema.safeParse(body);
  const upiRef = parsed.success ? cleanStr(parsed.data.upiRef, 64) : "";
  const order = await db.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  await db.payment.create({ data: { cafeId: order.cafeId, orderId: order.id, mode: "UPI", status: "PENDING", amount: order.total, providerRef: cleanPhone(upiRef) || upiRef } });
  await db.auditLog.create({ data: { cafeId: order.cafeId, action: "UPI_CLAIMED", meta: `${order.id} ref=${upiRef}` } });
  return NextResponse.json({ ok: true });
}
