import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Money ledger: every payment attempt per order, newest first.
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payments = await db.payment.findMany({
    where: { cafeId: s.cafeId },
    include: { order: { select: { tokenNo: true, tableCode: true, customerName: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const collected = payments.filter((p) => p.status === "PAID").reduce((a, p) => a + p.amount, 0);
  const pending = payments.filter((p) => p.status === "PENDING").reduce((a, p) => a + p.amount, 0);
  return NextResponse.json({ payments, collected, pending });
}
