import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanStr, isEmail, rateLimit, clientKey, tooMany } from "@/lib/security";

// Owner creates STAFF / KITCHEN logins so the team shares the load (not the password).
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staff = await db.user.findMany({
    where: { cafeId: s.cafeId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ staff });
}

const Schema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email().max(120),
  password: z.string().min(8).max(128),
  role: z.enum(["STAFF", "KITCHEN"]),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!rateLimit(clientKey(req, "staff"), 20, 60_000)) return tooMany();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Name, valid email, 8+ char password, role required" }, { status: 400 });
  const email = p.data.email.toLowerCase().trim();
  if (!isEmail(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  const u = await db.user.create({
    data: { name: cleanStr(p.data.name, 60), email, passwordHash: await hashPassword(p.data.password), role: p.data.role, cafeId: s.cafeId },
  });
  await db.auditLog.create({ data: { cafeId: s.cafeId, userId: s.uid, action: "STAFF_CREATED", meta: `${email} ${p.data.role}` } });
  return NextResponse.json({ ok: true, staff: { id: u.id, name: u.name, email: u.email, role: u.role } });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId || s.role !== "OWNER") return NextResponse.json({ error: "Owner only" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (id === s.uid) return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
  await db.user.deleteMany({ where: { id, cafeId: s.cafeId, role: { in: ["STAFF", "KITCHEN"] } } });
  return NextResponse.json({ ok: true });
}
