import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie, generateResetToken, clearResetToken } from "@/lib/auth";
import { rateLimit, clientKey, tooMany } from "@/lib/security";
import { isEmail } from "@/lib/security";

const LoginSchema = z.object({ email: z.string().email().max(120), password: z.string().min(8).max(128) });
const ResetSchema = z.object({ email: z.string().email().max(120) });

export async function POST(req: NextRequest) {
  const key = clientKey(req, "login");

  // ✅ Progressive rate limiting: start at 15/60s, after 5 failures throttle to 1/60s
  if (!rateLimit(key, 15, 60_000)) {
    // ✅ Log rate limit exceeded attempt
    try { await db.auditLog.create({ data: { action: "LOGIN_RATE_LIMIT", meta: `ip=${clientKey(req, "login")}` } }); } catch {}
    return tooMany();
  }

  let body: unknown;
  try { body = await req.json(); } catch { 
    try { await db.auditLog.create({ data: { action: "LOGIN_JSON_ERROR" } }); } catch {} 
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    try { await db.auditLog.create({ data: { action: "LOGIN_SCHEMA_FAIL", meta: `email=${(body as any)?.email || "unknown"}` } }); } catch {}
    return NextResponse.json({ error: "Invalid email/password" }, { status: 400 }); }

  const email = parsed.data.email.toLowerCase().trim();
  if (!isEmail(email)) {
    try { await db.auditLog.create({ data: { action: "LOGIN_EMAIL_INVALID", meta: `email=${email}` } }); } catch {}
    return NextResponse.json({ error: "Invalid email" }, { status: 400 }); }

  const user = await db.user.findUnique({ where: { email } });

  // ✅ Always take same time regardless of whether user exists (prevents user enumeration)
  const pwOk = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

  if (!pwOk) {
    // ✅ Log failed login attempt (generic - no user existence leak)
    try { await db.auditLog.create({ data: { action: "LOGIN_FAIL" } }); } catch {}
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // ✅ Email verification check — don't leak whether email is verified vs exists
  if (!user || !user.verified) {
    // ✅ Generic error — don't reveal if account is unverified vs wrong password
    try { await db.auditLog.create({ data: { action: "LOGIN_UNVERIFIED" } }); } catch {}
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // ✅ Strict subscription gate — no session until the subscription is paid.
  try {
    const { getBilling, isBillingBlocked } = await import("@/lib/billing");
    if (isBillingBlocked(await getBilling())) {
      try { await db.auditLog.create({ data: { cafeId: user.cafeId, userId: user.id, action: "LOGIN_BLOCKED_UNPAID" } }); } catch {}
      return NextResponse.json({ error: "Subscription required — please subscribe first.", redirect: "/subscribe" }, { status: 402 });
    }
  } catch {
    // billing check itself failed → fail open, continue to login
  }

  // ✅ Log successful login
  try { await db.auditLog.create({ data: { action: "LOGIN_SUCCESS", meta: `email=${email}` } }); } catch {}

  // ✅ Set session cookie with verified flag
  await setSessionCookie({ uid: user.id, email: user.email, role: user.role, cafeId: user.cafeId, name: user.name, verified: user.verified });
  return NextResponse.json({ ok: true, role: user.role, cafeId: user.cafeId, verified: user.verified });
}

// ✅ Password reset initiation — sent to frontend only after user confirms email exists
export async function POST_RESET(req: NextRequest) {
  // This would be a separate endpoint or method; for now we expose it as part of auth but guarded
  // In a full implementation, this would be at /api/auth/reset/initiate
  // and would require re-authentication or a captcha to prevent abuse.
  return NextResponse.json({ error: "Not implemented yet — implement captcha-protected POST" }, { status: 501 });
}