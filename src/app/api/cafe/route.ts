import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr } from "@/lib/security";

export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cafe = await db.cafe.findUnique({ where: { id: s.cafeId } });
  return NextResponse.json({ cafe });
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
});

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
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
  const ALLOWED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "JPY"];
  const cafe = await db.cafe.update({
    where: { id: s.cafeId },
    data: {
      name: cleanStr(d.name, 60), tagline: cleanStr(d.tagline, 120), description: cleanStr(d.description, 500),
      upiId: cleanStr(d.upiId, 60), gstPct: d.gstPct,
      ...(d.currency && ALLOWED_CURRENCIES.includes(d.currency) ? { currency: d.currency } : {}),
      ...(d.logoEmoji ? { logoEmoji: cleanStr(d.logoEmoji, 12) } : {}),
      ...theme,
    },
  });
  await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: Object.keys(theme).length ? "THEME_SAVED" : "SETTINGS_SAVED" } });
  return NextResponse.json({ ok: true, cafe });
}
