import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { activateSubscription, setSubscriptionStatus, getPlanFor } from "@/lib/billing";
import { PLANS, parseBilling, parsePlan } from "@/lib/plans";
import { limitRequest, tooMany } from "@/lib/security";

const Schema = z.object({
  action: z.enum(["activate", "extend", "cancel", "resume"]),
  plan: z.string().max(20).optional(),
  billing: z.string().max(10).optional(),
  // 0 = comp / no charge recorded. Capped at 36 months per action.
  months: z.number().int().min(0).max(36).optional(),
  note: z.string().max(200).optional().default(""),
  // Optional client-provided key so a double-clicked button is one action.
  txnKey: z.string().min(6).max(80).optional(),
});

// Platform operator actions for a single outlet: comp/manual activation,
// extension, cancellation and resume. Verified by ADMIN_EMAILS on every call.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await limitRequest(req, "admin", 60, 60_000))) return tooMany();

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const cafe = await db.cafe.findUnique({
    where: { id },
    select: { id: true, name: true, planTier: true, subBilling: true, subStatus: true, subPaidUntil: true },
  });
  if (!cafe) return NextResponse.json({ error: "Outlet not found" }, { status: 404 });

  const d = p.data;
  const txnKey = d.txnKey || `admin:${crypto.randomUUID()}`;
  const note = `admin:${admin.email} ${d.note}`.slice(0, 300);

  try {
    if (d.action === "cancel") {
      await setSubscriptionStatus({ cafeId: id, status: "canceled", note, txnKey });
      await db.auditLog.create({ data: { cafeId: id, action: "ADMIN_SUB_CANCELED", meta: note } }).catch(() => undefined);
      return NextResponse.json({ ok: true, status: "canceled" });
    }

    if (d.action === "resume") {
      // Resume does NOT extend the paid period — it only restores access when
      // an operator has verified a bank transfer or the account was wrongly
      // flagged. Period changes always go through activate/extend.
      const current = await db.cafe.findFirst({ where: { id, subStatus: { not: "active" } }, select: { id: true } });
      if (current) {
        await db.cafe.update({ where: { id }, data: { subStatus: "active" } });
        await db.billingEvent.create({
          data: { cafeId: id, kind: "activated", plan: cafe.planTier, billing: cafe.subBilling, ref: txnKey, txnKey, meta: note },
        });
      }
      await db.auditLog.create({ data: { cafeId: id, action: "ADMIN_SUB_RESUMED", meta: note } }).catch(() => undefined);
      return NextResponse.json({ ok: true, status: "active" });
    }

    const plan = d.plan ? parsePlan(d.plan) : await getPlanFor(id);
    const billing = d.billing ? parseBilling(d.billing) : (cafe.subBilling === "yearly" ? "yearly" : "monthly");
    const months = d.months ?? (billing === "yearly" ? 12 : 1);
    const amount =
      d.action === "activate" && d.months === 0
        ? 0
        : billing === "yearly" && months === 12
          ? PLANS[plan].yearlyTotal * 100
          : PLANS[plan].monthly * 100 * Math.max(1, months);

    const result = await activateSubscription({
      cafeId: id,
      plan,
      billing,
      ref: txnKey,
      amount,
      txnKey,
      months: d.action === "extend" ? Math.max(1, months) : months,
    });
    await db.auditLog
      .create({ data: { cafeId: id, action: d.action === "extend" ? "ADMIN_SUB_EXTENDED" : "ADMIN_SUB_ACTIVATED", meta: `${note} ${plan} ${billing} ${months}mo` } })
      .catch(() => undefined);

    return NextResponse.json({ ok: true, subStatus: "active", paidUntil: result.paidUntil, duplicate: result.duplicate });
  } catch (e) {
    console.error("ADMIN_SUB_ACTION_FAIL", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Action failed — try again." }, { status: 500 });
  }
}
