import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isProCafe, subscriptionGate } from "@/lib/billing";
import { cleanStr } from "@/lib/security";

// Inventory is a Pro module. Reading is cheap; writes are the interesting part.
async function guard() {
  const s = await getSession();
  if (!s?.cafeId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isProCafe(s.cafeId))) {
    return { error: NextResponse.json({ error: "Inventory is a Pro feature", pro: false }, { status: 403 }) };
  }
  return { cafeId: s.cafeId };
}

// GET /api/inventory — every item, with stock fields and its category name.
export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;

  const items = await db.menuItem.findMany({
    where: { cafeId: g.cafeId },
    select: {
      id: true, name: true, price: true, stock: true, lowAt: true, available: true, imageEmoji: true,
      category: { select: { name: true } },
    },
    orderBy: [{ sort: "asc" }, { name: "asc" }],
  });

  const tracked = items.filter((i) => i.stock !== null);
  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      stock: i.stock,
      lowAt: i.lowAt,
      available: i.available,
      emoji: i.imageEmoji,
      category: i.category?.name || "",
    })),
    summary: {
      total: items.length,
      tracked: tracked.length,
      low: tracked.filter((i) => (i.stock ?? 0) <= i.lowAt).length,
      out: tracked.filter((i) => (i.stock ?? 0) <= 0).length,
    },
  });
}

const Patch = z.object({
  id: z.string().min(1).max(64),
  // null turns tracking off; a number sets an exact count.
  stock: z.number().int().min(0).max(1000000).nullable().optional(),
  lowAt: z.number().int().min(0).max(1000000).optional(),
  available: z.boolean().optional(),
  name: z.string().max(80).optional(),
});

// PATCH /api/inventory — restock, set a threshold, mark sold out, rename.
export async function PATCH(req: NextRequest) {
  const g = await guard();
  if ("error" in g) return g.error;
  const gate = await subscriptionGate(g.cafeId);
  if (gate) return gate;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Patch.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  // Scope the write to this outlet — a guessed id can never touch another cafe.
  const existing = await db.menuItem.findFirst({ where: { id: p.data.id, cafeId: g.cafeId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const d = p.data;
  const item = await db.menuItem.update({
    where: { id: d.id },
    data: {
      ...(d.stock === undefined ? {} : { stock: d.stock }),
      ...(d.lowAt === undefined ? {} : { lowAt: d.lowAt }),
      ...(d.available === undefined ? {} : { available: d.available }),
      ...(d.name === undefined ? {} : { name: cleanStr(d.name, 80) }),
    },
    select: { id: true, name: true, stock: true, lowAt: true, available: true },
  });

  return NextResponse.json({ ok: true, item });
}
