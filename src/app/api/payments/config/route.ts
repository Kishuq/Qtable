import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret, verifyRazorpayKeys } from "@/lib/paykeys";
import { cleanStr, limitRequest, tooMany } from "@/lib/security";

// Owner self-serve gateway: paste Razorpay keys → we verify live against
// Razorpay → store AES-encrypted. No Vercel trips, no developer needed.
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const cafe = await db.cafe.findUnique({ where: { id: s.cafeId } });
  if (!cafe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const kid = cafe.razorpayKeyId || process.env.RAZORPAY_KEY_ID || "";
  return NextResponse.json({
    configured: Boolean(cafe.razorpayKeySecretEnc || (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)),
    fromEnv: !cafe.razorpayKeySecretEnc && Boolean(process.env.RAZORPAY_KEY_SECRET),
    live: cafe.razorpayLive,
    keyIdMasked: kid ? `${kid.slice(0, 8)}••••${kid.slice(-4)}` : "",
  });
}

const Schema = z.object({
  keyId: z.string().min(8).max(64),
  keySecret: z.string().min(8).max(128),
  live: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!(await limitRequest(req, "paycfg", 10, 60_000))) return tooMany();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Key ID + Key Secret required" }, { status: 400 });

  const keyId = cleanStr(p.data.keyId, 64);
  const keySecret = p.data.keySecret.trim();
  // Live check first — rejects typos instantly, works in test mode too.
  const ok = await verifyRazorpayKeys(keyId, keySecret);
  if (!ok) return NextResponse.json({ error: "Razorpay rejected these keys — check ID/secret and mode." }, { status: 400 });

  await db.cafe.update({
    where: { id: s.cafeId },
    data: { razorpayKeyId: keyId, razorpayKeySecretEnc: encryptSecret(keySecret), razorpayLive: p.data.live },
  });
  try {
    await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "GATEWAY_CONNECTED", meta: p.data.live ? "live" : "test" } });
  } catch {}
  return NextResponse.json({ ok: true, live: p.data.live });
}

export async function DELETE() {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  await db.cafe.update({ where: { id: s.cafeId }, data: { razorpayKeyId: "", razorpayKeySecretEnc: "", razorpayLive: false } });
  try {
    await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "GATEWAY_DISCONNECTED" } });
  } catch {}
  return NextResponse.json({ ok: true });
}
