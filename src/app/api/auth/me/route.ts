import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, isEmail, rateLimit, clientKey, tooMany } from "@/lib/security";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ user: null });
  const user = await db.user.findUnique({ where: { id: s.uid }, include: { cafe: true } });
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, cafeId: user.cafeId, cafe: user.cafe ? { id: user.cafe.id, name: user.cafe.name, slug: user.cafe.slug } : null },
  });
}

const PatchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  email: z.string().email().max(120).optional(),
  currentPassword: z.string().min(1).max(128).optional().default(""),
  newPassword: z.string().min(8).max(128).optional(),
});

// Authenticated account update: change own name/email/password.
// Password change requires currentPassword; email change requires uniqueness.
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientKey(req, "me-patch"), 20, 60_000)) return tooMany();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = PatchSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid account details" }, { status: 400 });

  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data: { name?: string; email?: string; passwordHash?: string } = {};
  if (p.data.name !== undefined) data.name = cleanStr(p.data.name, 60);
  if (p.data.email !== undefined) {
    const email = p.data.email.toLowerCase().trim();
    if (!isEmail(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    if (email !== user.email) {
      const exists = await db.user.findUnique({ where: { email } });
      if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      data.email = email;
    }
  }
  if (p.data.newPassword !== undefined) {
    const ok = await verifyPassword(p.data.currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    data.passwordHash = await hashPassword(p.data.newPassword);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await db.user.update({ where: { id: user.id }, data });
  try {
    await db.auditLog.create({
      data: { cafeId: user.cafeId, userId: user.id, action: "ACCOUNT_UPDATED", meta: Object.keys(data).join(",") },
    });
  } catch {}
  return NextResponse.json({ ok: true, user: { id: updated.id, name: updated.name, email: updated.email } });
}
