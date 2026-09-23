import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { rateLimit, clientKey, tooMany, isEmail } from "@/lib/security";

const Schema = z.object({ email: z.string().email().max(120) });

// Public forgot-password: always returns ok (no account enumeration).
// NOTE: no email provider is configured yet, so the reset token must be
// retrieved by the owner from the database (Neon → users → resetToken)
// or a future mail integration. Token expires in 24h.
export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "pw-request"), 5, 60_000)) return tooMany();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const email = p.data.email.toLowerCase().trim();
  if (!isEmail(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.user.update({ where: { email }, data: { resetToken: token, resetExpires: expires } });
      await db.auditLog.create({ data: { action: "PW_RESET_REQUEST", meta: `email=${email}` } });
    } else {
      await db.auditLog.create({ data: { action: "PW_RESET_REQUEST_MISS" } });
    }
  } catch {
    // best-effort logging only
  }
  return NextResponse.json({ ok: true });
}
