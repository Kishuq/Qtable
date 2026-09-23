import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit, clientKey, tooMany, isEmail } from "@/lib/security";

const Schema = z.object({
  email: z.string().email().max(120),
  token: z.string().min(32).max(128),
  newPassword: z.string().min(8).max(128),
});

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "pw-reset"), 10, 60_000)) return tooMany();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid reset details" }, { status: 400 });
  const email = p.data.email.toLowerCase().trim();
  if (!isEmail(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const user = await db.user.findUnique({ where: { email } });
  // Generic error — never reveal whether the email/token was wrong.
  const invalid = () => NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  if (!user || !user.resetToken || !user.resetExpires) {
    try {
      await db.auditLog.create({ data: { action: "PW_RESET_FAIL" } });
    } catch {}
    return invalid();
  }
  if (user.resetExpires.getTime() < Date.now() || !safeEqual(p.data.token.trim(), user.resetToken)) {
    try {
      await db.auditLog.create({ data: { cafeId: user.cafeId, userId: user.id, action: "PW_RESET_FAIL" } });
    } catch {}
    return invalid();
  }

  await db.user.update({
    where: { email },
    data: { passwordHash: await hashPassword(p.data.newPassword), resetToken: null, resetExpires: null },
  });
  try {
    await db.auditLog.create({ data: { cafeId: user.cafeId, userId: user.id, action: "PW_RESET_SUCCESS" } });
  } catch {}
  return NextResponse.json({ ok: true });
}
