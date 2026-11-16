import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptionGate } from "@/lib/billing";
import { cleanStr } from "@/lib/security";

export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cafe = await db.cafe.findUnique({ where: { id: s.cafeId } });
  if (!cafe) return NextResponse.json({ error: "Outlet not found" }, { status: 404 });
  // The AES-encrypted gateway secret must never leave the server, even to the
  // owner's browser. The boolean is all the settings UI needs to show status.
  const { cashfreeSecretEnc, ...safe } = cafe;
  return NextResponse.json({ cafe: { ...safe, hasCashfreeSecret: Boolean(cashfreeSecretEnc) } });
}

const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/).optional();

const Schema = z.object({
  name: z.string().min(2).max(60),
  tagline: z.string().max(120).optional().default(""),
  description: z.string().max(500).optional().default(""),
  upiId: z.string().max(60).optional().default(""),
  gstPct: z.number().min(0).max(30).optional().default(5),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  logoEmoji: z.string().max(12).optional(),
  themePrimary: HEX,
  themeAccent: HEX,
  themeBg: HEX,
  themeBgMode: z.enum(["solid", "gradient"]).optional(),
  themePattern: z.enum(["none", "dots", "grid", "waves"]).optional(),
  themeFont: z.string().max(20).optional(),
  themeRadius: z.enum(["rounded", "soft", "sharp"]).optional(),
  themeStyle: z.enum(["cards", "editorial", "list", "poster", "tickets"]).optional(),
  themeWash: z.number().int().min(50).max(98).optional(),
  // Empty string clears the backdrop. Accepts an https URL, a previously
  // stored /api/public/photo/<id>, or a small self-contained data image.
  // Data images are moved into MenuPhoto on save so the public menu payload
  // stays small (a 300 KB base64 backdrop would otherwise be re-sent on every
  // cold scan).
  themeImage: z.string().max(400_000).refine(
    (v) =>
      v === "" ||
      /^https:\/\/[^\s"']+$/.test(v) ||
      /^\/api\/public\/photo\/[a-z0-9]{10,40}$/i.test(v) ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Invalid image",
  ).optional(),
});

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const gate = await subscriptionGate(s.cafeId);
  if (gate) return gate;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  const d = p.data;
  const theme: Record<string, string> = {};
  if (d.themePrimary) theme.themePrimary = d.themePrimary;
  if (d.themeAccent) theme.themeAccent = d.themeAccent;
  if (d.themeBg) theme.themeBg = d.themeBg;
  if (d.themeBgMode) theme.themeBgMode = d.themeBgMode;
  if (d.themePattern) theme.themePattern = d.themePattern;
  if (d.themeFont) theme.themeFont = cleanStr(d.themeFont, 20);
  if (d.themeRadius) theme.themeRadius = d.themeRadius;
  if (d.themeStyle) theme.themeStyle = d.themeStyle;

  const current = await db.cafe.findUnique({ where: { id: s.cafeId }, select: { themeImage: true } });
  const oldPhotoId = current?.themeImage?.match(/^\/api\/public\/photo\/([a-z0-9]{10,40})$/i)?.[1];
  let newPhotoId: string | undefined;

  if (typeof d.themeImage === "string") {
    if (d.themeImage.startsWith("data:image/")) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(d.themeImage);
      if (!m) return NextResponse.json({ error: "Invalid image" }, { status: 400 });
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 400_000) return NextResponse.json({ error: "Photo too large — choose a smaller one." }, { status: 400 });
      // Store the bytes and hand the public menu a tiny immutable URL. This
      // keeps /api/public/cafe cacheable and stops a 300 KB backdrop from
      // riding along on every scan.
      const photo = await db.menuPhoto.create({
        data: { cafeId: s.cafeId, data: buf, mime: `image/${m[1]}` },
        select: { id: true },
      });
      newPhotoId = photo.id;
      theme.themeImage = `/api/public/photo/${photo.id}`;
    } else {
      theme.themeImage = d.themeImage;
    }
  }
  const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "JPY"];
  const cafe = await db.cafe.update({
    where: { id: s.cafeId },
    data: {
      name: cleanStr(d.name, 60), tagline: cleanStr(d.tagline, 120), description: cleanStr(d.description, 500),
      upiId: cleanStr(d.upiId, 60), gstPct: d.gstPct,
      ...(d.currency && ALLOWED_CURRENCIES.includes(d.currency) ? { currency: d.currency } : {}),
      ...(d.logoEmoji ? { logoEmoji: cleanStr(d.logoEmoji, 12) } : {}),
      ...theme,
      ...(d.themeWash !== undefined ? { themeWash: d.themeWash } : {}),
    },
  });
  await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: Object.keys(theme).length ? "THEME_SAVED" : "SETTINGS_SAVED" } });
  // Drop the previous backdrop row once the new reference is saved. Skipped
  // when the owner kept the same photo.
  if (oldPhotoId && oldPhotoId !== newPhotoId) {
    await db.menuPhoto.deleteMany({ where: { id: oldPhotoId, cafeId: s.cafeId } }).catch(() => undefined);
  }
  const { cashfreeSecretEnc, ...safe } = cafe;
  return NextResponse.json({ ok: true, cafe: { ...safe, hasCashfreeSecret: Boolean(cashfreeSecretEnc) } });
}
