import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCafe } from "@/lib/cafe";
import { db } from "@/lib/db";
import { rateLimit, clientKey, tooMany, cleanStr } from "@/lib/security";

// UUID v4 pattern (simplified — matches standard format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const Schema = z.object({
  orderId: z.string().regex(UUID_PATTERN).optional().default(""),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(300).optional().default(""),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "feedback"), 10, 60_000)) return tooMany();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  let cafe;
  try { cafe = await requireCafe(); } catch { return NextResponse.json({ error: "Cafe not found" }, { status: 404 }); }
  // ✅ If orderId is provided, verify it belongs to this cafe
  if (p.data.orderId) {
    const order = await db.order.findFirst({ where: { id: p.data.orderId, cafeId: cafe.id } });
    if (!order) return NextResponse.json({ error: "Order not found or does not belong to this cafe" }, { status: 400 });
  }
  await db.feedback.create({ data: { cafeId: cafe.id, orderId: cleanStr(p.data.orderId, 64), rating: p.data.rating, comment: cleanStr(p.data.comment, 300) } });
  return NextResponse.json({ ok: true });
}
