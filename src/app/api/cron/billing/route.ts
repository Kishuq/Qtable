import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPastDue, planLabel, normalizePlan } from "@/lib/billing";
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
  const lapsed = await db.cafe.findMany({
    where: { subStatus: "active", subPaidUntil: { lte: now } },
    select: { id: true },
    take: MAX_PER_RUN,
  });
  for (const c of lapsed) {
    const info = await ownerOf(c.id);
    await markPastDue(c.id);
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
  }

  // ---- 2. Remind before the gate closes ----
  const dueSoon = await db.cafe.findMany({
    where: { subStatus: "active", subPaidUntil: { gt: now, lte: soon } },
    select: { id: true, subPaidUntil: true },
    take: MAX_PER_RUN,
  });
  for (const c of dueSoon) {
    const paidUntil = c.subPaidUntil!;
    const stamp = paidUntil.toISOString();

    // One reminder per paid period. The ref is the exact paid-until timestamp,
    // so renewing produces a fresh period and therefore a fresh reminder.
    const already = await db.billingEvent.findFirst({
      where: { cafeId: c.id, kind: "reminder", ref: stamp },
      select: { id: true },
    });
    if (already) continue;

    const info = await ownerOf(c.id);
    if (!info?.owner?.email) continue;
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
  }

  return NextResponse.json({ ok: true, expired, reminded, at: now.toISOString() });
}
