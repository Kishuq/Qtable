import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie, readGoogleSignup, GOOGLE_SIGNUP_COOKIE } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { limitRequest, tooMany, cleanStr, isEmail } from "@/lib/security";
import { DEMO_CATEGORIES, DEMO_ITEMS } from "@/lib/demo-data";
import { uniqueSlug } from "@/lib/cafe";
import { normalizePlan } from "@/lib/billing";

const Schema = z.object({
  cafeName: z.string().min(2).max(60),
  name: z.string().min(2).max(60),
  // Optional when Google has already verified the identity.
  email: z.string().max(120).optional().default(""),
  password: z.string().max(128).optional().default(""),
  upiId: z.string().max(60).optional().default(""),
  // Explicitly opt out of the Google identity captured moments ago.
  useGoogle: z.boolean().optional().default(true),
  // Preselected plan from the pricing cards. Anything unknown → Standard.
  plan: z.string().max(20).optional().default("standard"),
});

// Open signup: anyone can open an outlet. The account is created immediately
// and signed in, but the outlet starts in PREVIEW mode (subStatus = pending) —
// the dashboard is fully viewable, every write is refused until subscribed.
// This is the Hostinger flow: get inside, look around, pay to use.
export async function POST(req: NextRequest) {
  if (!(await limitRequest(req, "setup", 10, 60_000))) return tooMany();

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

  // One account per email across the whole platform. Signing up twice with the
  // same address should send the person to login, not create a duplicate.
  const already = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (already) {
    return NextResponse.json(
      { error: "An account with this email already exists. Log in instead.", redirect: "/login" },
      { status: 409 },
    );
  }

  let password = parsed.data.password;
  if (!google) {
    if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  } else if (!password) {
    // Unused random password — this account signs in with Google only.
    password = crypto.randomBytes(32).toString("base64url");
  }

  const ownerName = cleanStr(google?.name || name, 60);
  const plan = normalizePlan(parsed.data.plan);
  const slug = await uniqueSlug(cafeName);

  // One transaction: a half-created account (user without a cafe) would break
  // every dashboard page, so either everything lands or nothing does.
  const { user, cafe } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: ownerName,
        email,
        passwordHash: await hashPassword(password),
        provider: google ? "google" : "password",
        role: "OWNER",
        verified: true,
      },
    });

    const cafe = await tx.cafe.create({
      data: {
        name: cleanStr(cafeName, 60),
        slug,
        tagline: "Scan. Order. Enjoy.",
        upiId: cleanStr(upiId, 60),
        ownerId: user.id,
        planTier: plan,
        subStatus: "pending",
        subBilling: "monthly",
      },
    });

    await tx.user.update({ where: { id: user.id }, data: { cafeId: cafe.id } });

    const catMap: Record<string, string> = {};
    for (let i = 0; i < DEMO_CATEGORIES.length; i++) {
      const c = await tx.category.create({ data: { cafeId: cafe.id, name: DEMO_CATEGORIES[i], sort: i } });
      catMap[c.name] = c.id;
    }
    for (let i = 0; i < DEMO_ITEMS.length; i++) {
      const it = DEMO_ITEMS[i];
      await tx.menuItem.create({
        data: { cafeId: cafe.id, categoryId: catMap[it.cat], name: it.name, description: it.description, price: it.price, imageEmoji: it.imageEmoji, imageUrl: it.img, veg: it.veg, popular: it.popular, sort: i },
      });
    }
    for (let t = 1; t <= 12; t++) {
      await tx.cafeTable.create({ data: { cafeId: cafe.id, code: `T${t}`, name: `Table ${t}` } });
    }
    await tx.coupon.create({ data: { cafeId: cafe.id, code: "WELCOME10", pct: 10 } });
    await tx.auditLog.create({ data: { cafeId: cafe.id, userId: user.id, action: google ? "SIGNUP_GOOGLE" : "SIGNUP_EMAIL", meta: `slug=${slug} plan=${plan}` } });

    return { user, cafe };
  });

  // Signed in immediately — the owner lands in the dashboard preview, not back
  // on a login form. Session lasts 30 days.
  await setSessionCookie({ uid: user.id, email: user.email, role: "OWNER", cafeId: cafe.id, name: user.name, verified: true });
  jar.set(GOOGLE_SIGNUP_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true, slug: cafe.slug });
}

// Public status for the setup page: signup is always open now. The Google
// identity is only present when the visitor just came back from Google.
export async function GET() {
  const jar = await cookies();
  const google = readGoogleSignup(jar.get(GOOGLE_SIGNUP_COOKIE)?.value || "");
  return NextResponse.json({
    needsSetup: true,
    open: true,
    google: google ? { email: google.email, name: google.name } : null,
    googleEnabled: googleConfigured(),
  });
}
