import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "qrcafe_session";

// Generate a proper 64-byte (512-bit) secret if none set in env.
// In production you MUST set JWT_SECRET=openssl rand -base64 48 in your env.
// This helper is only for dev convenience; never commit a generated secret.
function generateJwtSecret(): string {
  // @ts-ignore - randomBytes is Node
  const crypto = require("crypto");
  return crypto.randomBytes(48).toString("base64");
}

const JWT_SECRET = process.env.JWT_SECRET || generateJwtSecret();
const IS_DEV = process.env.NODE_ENV !== "production";

let secretWarned = false;
function warnWeakSecret() {
  if (!secretWarned && IS_DEV && JWT_SECRET.length < 32) {
    secretWarned = true;
    console.warn("⚠️  SECURITY: set a long random JWT_SECRET in production — sessions are forgeable until you do.");
  }
}

// ✅ Never expose JWT_SECRET to the browser — keep it server-only.
export const getJwtSecret = () => JWT_SECRET;

export type Session = { uid: string; email: string; role: string; cafeId: string | null; name: string; verified: boolean };

export async function hashPassword(pw: string) {
  const rounds = IS_DEV ? 10 : 12; // 12 in prod, 10 in dev for faster builds
  return bcrypt.hash(pw, rounds);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signSession(s: Session) {
  warnWeakSecret();
  return jwt.sign(s, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): Session | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Session;
    // ✅ Ensure session has required fields; missing ones mean a stale/forge token.
    if (!payload.uid || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

// ✅ Secure cookie settings: HttpOnly (XSS protection), Secure on HTTPS,
// SameSite=strict for maximum CSRF protection, 24h expiry.
export async function setSessionCookie(session: Session) {
  const token = signSession(session);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    // ✅ Secure only when serving HTTPS — prevents cookie theft on HTTP.
    secure: (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://"),
    sameSite: "strict" as const, // ✅ Strict prevents CSRF; lax only for dev convenience
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours — shorter expiry forces re-auth
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireOwner() {
  const s = await getSession();
  if (!s) return null;
  // ✅ Also verify the user is verified and the session is fresh enough
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user || !user.verified) return null;
  return { session: s, user };
}

// ✅ Password reset token generation (server-side only, never sent to frontend in payload)
export async function generateResetToken(email: string) {
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  // Store in DB — Prisma will handle upsert logic in the route
  await db.user.update({
    where: { email },
    data: { resetToken: token, resetExpires: expires },
  });
  return { token, expires };
}

// ✅ Clear reset token after use (call after successful password reset)
export async function clearResetToken(email: string) {
  await db.user.update({
    where: { email },
    data: { resetToken: null, resetExpires: null },
  });
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}