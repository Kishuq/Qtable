import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { rateLimit, clientKey, tooMany, cleanStr, isEmail } from "@/lib/security";
import { DEMO_CATEGORIES, DEMO_ITEMS } from "@/lib/demo-data";

const Schema = z.object({
  cafeName: z.string().min(2).max(60),
  name: z.string().min(2).max(60),
  email: z.string().email().max(120),
  password: z.string().min(8).max(128),
  upiId: z.string().max(60).optional().default(""),
});

// First-run setup: creates THE cafe + owner. Locked forever after first use.
export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "setup"), 10, 60_000)) return tooMany();
  const existing = await db.user.count();
  if (existing > 0) return NextResponse.json({ error: "Already set up. Please log in." }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    try { await db.auditLog.create({ data: { action: "SETUP_SCHEMA_FAIL" } }); } catch {}
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { cafeName, name, email, password, upiId } = parsed.data;
  const cleanEmail = email.toLowerCase().trim();
  if (!isEmail(cleanEmail)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const user = await db.user.create({ data: { name: cleanStr(name, 60), email: cleanEmail, passwordHash: await hashPassword(password), role: "OWNER", verified: true } });
  try { await db.auditLog.create({ data: { action: "SETUP_SUCCESS", meta: `email=${cleanEmail}` } }); } catch {}

  const cafe = await db.cafe.create({
    data: { name: cleanStr(cafeName, 60), slug: "cafe", tagline: "Scan. Order. Sip. Repeat.", upiId: cleanStr(upiId, 60), ownerId: user.id },
  });
  await db.user.update({ where: { id: user.id }, data: { cafeId: cafe.id } });

  const catMap: Record<string, string> = {};
  for (let i = 0; i < DEMO_CATEGORIES.length; i++) {
    const c = await db.category.create({ data: { cafeId: cafe.id, name: DEMO_CATEGORIES[i], sort: i } });
    catMap[c.name] = c.id;
  }
  for (let i = 0; i < DEMO_ITEMS.length; i++) {
    const it = DEMO_ITEMS[i];
    await db.menuItem.create({
      data: { cafeId: cafe.id, categoryId: catMap[it.cat], name: it.name, description: it.description, price: it.price, imageEmoji: it.imageEmoji, imageUrl: it.img, veg: it.veg, popular: it.popular, sort: i },
    });
  }
  for (let t = 1; t <= 12; t++) {
    await db.cafeTable.create({ data: { cafeId: cafe.id, code: `T${t}`, name: `Table ${t}` } });
  }
  await db.coupon.create({ data: { cafeId: cafe.id, code: "WELCOME10", pct: 10 } });
  await db.auditLog.create({ data: { cafeId: cafe.id, userId: user.id, action: "CAFE_SETUP" } });

  await setSessionCookie({ uid: user.id, email: user.email, role: "OWNER", cafeId: cafe.id, name: user.name, verified: true });
  return NextResponse.json({ ok: true });
}

// Lets the setup page know whether first-run is still available.
export async function GET() {
  const count = await db.user.count();
  return NextResponse.json({ needsSetup: count === 0 });
}
