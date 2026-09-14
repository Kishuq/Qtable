import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ user: null });
  const user = await db.user.findUnique({ where: { id: s.uid }, include: { cafe: true } });
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, cafeId: user.cafeId, cafe: user.cafe ? { id: user.cafe.id, name: user.cafe.name, slug: user.cafe.slug } : null },
  });
}
