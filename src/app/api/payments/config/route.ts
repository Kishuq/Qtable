import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret, verifyCashfreeKeys } from "@/lib/paykeys";
import { subscriptionGate } from "@/lib/billing";
import { cleanStr, limitRequest, tooMany } from "@/lib/security";

// Owner self-serve gateway: paste Cashfree App ID + Secret Key → we verify live
// against Cashfree → store AES-encrypted. No Vercel trips, no developer needed.
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const cafe = await db.cafe.findUnique({ where: { id: s.cafeId } });
  if (!cafe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const kid = cafe.cashfreeAppId || process.env.CASHFREE_APP_ID || "";
  return NextResponse.json({
    configured: Boolean(cafe.cashfreeSecretEnc || (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY)),
    fromEnv: !cafe.cashfreeSecretEnc && Boolean(process.env.CASHFREE_SECRET_KEY),
    live: cafe.cashfreeLive,
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
  const gate = await subscriptionGate(s.cafeId);
  if (gate) return gate;
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
  const ok = await verifyCashfreeKeys(keyId, keySecret, p.data.live ?? false);
  if (!ok) return NextResponse.json({ error: "Cashfree rejected these keys — check ID/secret and mode." }, { status: 400 });

  await db.cafe.update({
    where: { id: s.cafeId },
    data: { cashfreeAppId: keyId, cashfreeSecretEnc: encryptSecret(keySecret), cashfreeLive: p.data.live ?? false },
  });
  try {
    await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "CF_GATEWAY_CONNECTED", meta: p.data.live ? "live" : "test" } });
  } catch {}
  return NextResponse.json({ ok: true, live: p.data.live ?? false });
}

export async function DELETE() {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const gate = await subscriptionGate(s.cafeId);
  if (gate) return gate;
  await db.cafe.update({ where: { id: s.cafeId }, data: { cashfreeAppId: "", cashfreeSecretEnc: "", cashfreeLive: false } });
  try {
    await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "CF_GATEWAY_DISCONNECTED" } });
  } catch {}
  return NextResponse.json({ ok: true });
}
