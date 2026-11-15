import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPastDue, planLabel, normalizePlan, graceDays } from "@/lib/billing";
import { sendEmail, renewalReminderHtml, paymentFailedHtml } from "@/lib/email";
import { PLANS } from "@/lib/plans";
import { appBaseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily subscription hygiene across ALL outlets — the part that makes "many
// subscriptions" operable without watching a dashboard by hand.
//
//   1. Expire: active outlets whose paid-until has passed → past_due.
//   2. Remind: active outlets renewing within 3 days → one email per period.
//
// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Without
// that secret the route stays closed, so it can never be used as a free
// email-sending endpoint by the public.
const REMIND_DAYS = 3;
const MAX_PER_RUN = 200;

// Bounded parallelism: with thousands of outlets a strictly sequential loop
// would blow the 60s function limit. Eight at a time keeps DB + email pressure
// predictable while finishing a full run in seconds.
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(
      items.slice(i, i + size).map(async (item) => {
        // One broken outlet (bad email, transient DB error) must never abort the
        // rest of the daily run.
        try {
          await fn(item);
        } catch (e) {
          console.error("CRON_ITEM_FAIL", e instanceof Error ? e.message : e);
        }
      }),
    );
  }
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function ownerOf(cafeId: string) {
  const cafe = await db.cafe.findUnique({
    where: { id: cafeId },
    select: { name: true, slug: true, ownerId: true, planTier: true, subBilling: true },
  });
  if (!cafe) return null;
  const owner = cafe.ownerId
    ? await db.user.findUnique({ where: { id: cafe.ownerId }, select: { email: true, name: true } })
    : null;
  return { cafe, owner };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const soon = new Date(now.getTime() + REMIND_DAYS * 24 * 60 * 60 * 1000);
  let expired = 0;
  let reminded = 0;

  // ---- 1. Close the gate on lapsed outlets ----
  // Honor BILLING_GRACE_DAYS: a mandate settling a day late must not cut off a
  // café that has already paid. The same window is used by isSubscriptionActive.
  const graceCutoff = new Date(now.getTime() - graceDays() * 24 * 60 * 60 * 1000);
  const lapsed = await db.cafe.findMany({
    where: { subStatus: "active", subPaidUntil: { lte: graceCutoff } },
    select: { id: true },
    take: MAX_PER_RUN,
  });
  await inBatches(lapsed, 8, async (c) => {
    // Conditional update: a renewal that lands between the query and the write
    // wins, and we don't email a customer whose payment just cleared.
    if (!(await markPastDue(c.id))) return;
    const info = await ownerOf(c.id);
    expired++;
    if (info?.owner?.email) {
      const plan = planLabel(normalizePlan(info.cafe.planTier));
      const amount = `₹${(info.cafe.subBilling === "yearly" ? PLANS[normalizePlan(info.cafe.planTier)].yearlyTotal : PLANS[normalizePlan(info.cafe.planTier)].monthly).toLocaleString("en-IN")}`;
      await sendEmail({
        to: info.owner.email,
        subject: `Qtable — ${info.cafe.name} is now in preview mode`,
        html: paymentFailedHtml({ name: info.owner.name || "there", amount: `${plan} · ${amount}` }),
      }).catch(() => false);
    }
  });

  // ---- 2. Remind before the gate closes ----
  const dueSoon = await db.cafe.findMany({
    where: { subStatus: "active", subPaidUntil: { gt: now, lte: soon } },
    select: { id: true, subPaidUntil: true },
    take: MAX_PER_RUN,
  });
  await inBatches(dueSoon, 8, async (c) => {
    const paidUntil = c.subPaidUntil!;
    const stamp = paidUntil.toISOString();

    // One reminder per paid period. The ref is the exact paid-until timestamp,
    // so renewing produces a fresh period and therefore a fresh reminder.
    const already = await db.billingEvent.findFirst({
      where: { cafeId: c.id, kind: "reminder", ref: stamp },
      select: { id: true },
    });
    if (already) return;

    const info = await ownerOf(c.id);
    if (!info?.owner?.email) return;
    const plan = normalizePlan(info.cafe.planTier);
    const amount = `₹${(info.cafe.subBilling === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly).toLocaleString("en-IN")}`;
    const date = paidUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    await sendEmail({
      to: info.owner.email,
      subject: `Qtable — ${info.cafe.name} renews on ${date}`,
      html: renewalReminderHtml({
        name: info.owner.name || "there",
        plan: planLabel(plan),
        amount: `${amount} ${info.cafe.subBilling === "yearly" ? "/ year" : "/ month"}`,
        date,
        url: `${appBaseUrl()}/subscribe?plan=${plan}&billing=${info.cafe.subBilling}`,
      }),
    }).catch(() => false);

    await db.billingEvent
      .create({ data: { cafeId: c.id, kind: "reminder", plan, billing: info.cafe.subBilling, ref: stamp, meta: `due=${date}` } })
      .catch(() => undefined);
    reminded++;
  });

  // ---- 3. Retention: audit rows are diagnostic, not financial. Keep 90 days
  // and prune in bounded batches so one run can never lock the table.
  let pruned = 0;
  try {
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    pruned = await db.$executeRaw`
      DELETE FROM "AuditLog" WHERE "id" IN (
        SELECT "id" FROM "AuditLog" WHERE "createdAt" < ${cutoff} LIMIT 5000
      )
    `;
  } catch { /* retention must never fail the billing job */ }

  return NextResponse.json({ ok: true, expired, reminded, pruned, at: now.toISOString() });
}
