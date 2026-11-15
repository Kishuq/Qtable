import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin";
import { PLANS, type PlanId } from "@/lib/plans";
import { AdminConsole, type AdminCafe, type AdminEvent } from "./admin-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Qtable — Platform console", robots: { index: false, follow: false } };

function monthlyValue(plan: string, billing: string): number {
  const p = PLANS[(plan === "menu" || plan === "pro" ? plan : "standard") as PlanId];
  return billing === "yearly" ? Math.round(p.yearlyTotal / 12) : p.monthly;
}

export default async function AdminPage() {
  // ADMIN_EMAILS is the only gate. Anyone else sees a 404 so the console's
  // existence isn't advertised.
  const admin = await getAdminSession();
  if (!admin) notFound();

  const [cafes, events, statusCounts, activeRows] = await Promise.all([
    db.cafe.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true, name: true, slug: true, planTier: true, subStatus: true, subBilling: true,
        subPaidUntil: true, subAutoRenew: true, createdAt: true, isActive: true,
        users: { where: { role: "OWNER" }, select: { email: true, name: true } },
        _count: { select: { orders: true, items: true, tables: true } },
      },
    }),
    db.billingEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, cafeId: true, kind: true, plan: true, billing: true, amount: true, ref: true, createdAt: true, cafe: { select: { name: true } } },
    }),
    // Counts/MRR are computed over ALL outlets, not just the 500 rendered rows —
    // otherwise the headline numbers silently lie once the platform grows.
    db.cafe.groupBy({ by: ["subStatus"], _count: { _all: true } }),
    db.cafe.findMany({ where: { subStatus: "active" }, select: { planTier: true, subBilling: true, subPaidUntil: true } }),
  ]);

  const now = Date.now();
  const countFor = (s: string) => statusCounts.find((x) => x.subStatus === s)?._count._all ?? 0;
  const totals = {
    outlets: statusCounts.reduce((n, x) => n + x._count._all, 0),
    active: countFor("active"),
    pastDue: countFor("past_due"),
    pending: countFor("pending"),
    mrr: activeRows
      .filter((r) => !r.subPaidUntil || r.subPaidUntil.getTime() > now)
      .reduce((sum, r) => sum + monthlyValue(r.planTier, r.subBilling), 0),
  };

  const rows: AdminCafe[] = cafes.map((c) => {
    const paidUntil = c.subPaidUntil ? c.subPaidUntil.toISOString() : null;
    const inPaidWindow = !c.subPaidUntil || c.subPaidUntil.getTime() > now;
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      ownerEmail: c.users[0]?.email || "",
      ownerName: c.users[0]?.name || "",
      plan: c.planTier,
      status: c.subStatus,
      billing: c.subBilling,
      paidUntil,
      autoRenew: c.subAutoRenew,
      createdAt: c.createdAt.toISOString(),
      isActive: c.isActive,
      orders: c._count.orders,
      items: c._count.items,
      tables: c._count.tables,
      mrr: c.subStatus === "active" && inPaidWindow ? monthlyValue(c.planTier, c.subBilling) : 0,
    };
  });

  const ledger: AdminEvent[] = events.map((e) => ({
    id: e.id,
    cafeId: e.cafeId,
    cafeName: e.cafe?.name || "—",
    kind: e.kind,
    plan: e.plan,
    billing: e.billing,
    amount: e.amount,
    ref: e.ref,
    createdAt: e.createdAt.toISOString(),
  }));

  return <AdminConsole adminEmail={admin.email} cafes={rows} events={ledger} totals={totals} />;
}
