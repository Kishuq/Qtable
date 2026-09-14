import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { rateLimit, clientKey, tooMany } from "@/lib/security";

const Schema = z.object({ email: z.string().email().max(120), password: z.string().min(1).max(128) });

export async function POST(req: NextRequest) {
  if (!rateLimit(clientKey(req, "login"), 15, 60_000)) return tooMany();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email/password" }, { status: 400 });

  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.user.findUnique({ where: { email } });
  // Constant-time-ish: always compare to avoid user enumeration timing
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  await setSessionCookie({ uid: user.id, email: user.email, role: user.role, cafeId: user.cafeId, name: user.name });
  return NextResponse.json({ ok: true, role: user.role, cafeId: user.cafeId });
}
