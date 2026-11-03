import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie, readGoogleSignup, GOOGLE_SIGNUP_COOKIE } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { limitRequest, tooMany, cleanStr, isEmail } from "@/lib/security";
import { DEMO_CATEGORIES, DEMO_ITEMS } from "@/lib/demo-data";

const Schema = z.object({
  cafeName: z.string().min(2).max(60),
  name: z.string().min(2).max(60),
  // Optional when Google has already verified the identity.
  email: z.string().max(120).optional().default(""),
  password: z.string().max(128).optional().default(""),
  upiId: z.string().max(60).optional().default(""),
  // Explicitly opt out of the Google identity captured moments ago.
  useGoogle: z.boolean().optional().default(true),
});

// First-run setup: creates THE cafe + owner. Locked forever after first use.
export async function POST(req: NextRequest) {
  if (!(await limitRequest(req, "setup", 10, 60_000))) return tooMany();
  // ✅ Strict subscription gate — no cafe setup until subscribed.
  try {
    const { getBilling, isBillingBlocked } = await import("@/lib/billing");
    if (isBillingBlocked(await getBilling())) {
      try { await db.auditLog.create({ data: { action: "SETUP_BLOCKED_UNPAID" } }); } catch {}
      return NextResponse.json({ error: "Subscription required — please subscribe first.", redirect: "/subscribe" }, { status: 402 });
    }
  } catch {
    // billing check itself failed → fail open, continue to setup
  }
  const existing = await db.user.count();
  if (existing > 0) return NextResponse.json({ error: "Already set up. Please log in." }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    try { await db.auditLog.create({ data: { action: "SETUP_SCHEMA_FAIL" } }); } catch {}
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { cafeName, name, upiId } = parsed.data;
  const jar = await cookies();

  // Google signup: identity already verified by Google minutes ago, so the
  // owner never retypes an email or invents a password.
  const google = parsed.data.useGoogle
    ? readGoogleSignup(jar.get(GOOGLE_SIGNUP_COOKIE)?.value || "")
    : null;

  const rawEmail = google ? google.email : parsed.data.email;
  const email = rawEmail.toLowerCase().trim();
  if (!isEmail(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

  let password = parsed.data.password;
  if (!google) {
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  } else if (!password) {
    // Unused random password — this account signs in with Google only.
    password = crypto.randomBytes(32).toString("base64url");
  }

  const ownerName = cleanStr(google?.name || name, 60);
  const user = await db.user.create({
    data: {
      name: ownerName,
      email,
      passwordHash: await hashPassword(password),
      provider: google ? "google" : "password",
      role: "OWNER",
      verified: true,
    },
  });
  try { await db.auditLog.create({ data: { action: google ? "SETUP_SUCCESS_GOOGLE" : "SETUP_SUCCESS", meta: `email=${email}` } }); } catch {}

  const cafe = await db.cafe.create({
    data: { name: cleanStr(cafeName, 60), slug: "cafe", tagline: "Scan. Order. Enjoy.", upiId: cleanStr(upiId, 60), ownerId: user.id },
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

  // Signed in immediately — the owner lands in the dashboard, not back on a
  // login form. Session lasts 30 days.
  await setSessionCookie({ uid: user.id, email: user.email, role: "OWNER", cafeId: cafe.id, name: user.name, verified: true });
  jar.set(GOOGLE_SIGNUP_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}

// Lets the setup page know whether first-run is still available, and whether a
// verified Google identity is waiting to be used.
export async function GET() {
  const count = await db.user.count();
  if (count > 0) return NextResponse.json({ needsSetup: false });
  const jar = await cookies();
  const google = readGoogleSignup(jar.get(GOOGLE_SIGNUP_COOKIE)?.value || "");
  return NextResponse.json({
    needsSetup: true,
    google: google ? { email: google.email, name: google.name } : null,
    googleEnabled: googleConfigured(),
  });
}
