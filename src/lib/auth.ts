import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "qrcafe_session";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-32chars-min!!";

let secretWarned = false;
function warnWeakSecret() {
  // Checked on the auth path (not at import) so build logs stay clean,
  // but any real production login with a weak secret screams once.
  if (!secretWarned && process.env.NODE_ENV === "production" && (JWT_SECRET.length < 32 || JWT_SECRET.includes("change-me"))) {
    secretWarned = true;
    console.warn("⚠️  SECURITY: set a long random JWT_SECRET in production — sessions are forgeable until you do.");
  }
}

export type Session = { uid: string; email: string; role: string; cafeId: string | null; name: string };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function signSession(s: Session) {
  warnWeakSecret();
  return jwt.sign(s, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): Session | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Session) {
  const token = signSession(session);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    // Secure only when actually serving HTTPS — keeps localhost/http logins working
    secure: (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
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
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user) return null;
  return { session: s, user };
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}
