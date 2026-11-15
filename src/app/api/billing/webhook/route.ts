import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { sendEmail, invoiceHtml, paymentFailedHtml } from "@/lib/email";
import { db } from "@/lib/db";
import { activateSubscription, planLabel, markPastDue } from "@/lib/billing";
import { PLANS, parseBilling, parsePlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

function razorpay() {
  const key_id = process.env.BILLING_RAZORPAY_KEY_ID || "";
  const key_secret = process.env.BILLING_RAZORPAY_KEY_SECRET || "";
  return key_id && key_secret ? new Razorpay({ key_id, key_secret }) : null;
}

// Platform billing webhook — point Razorpay webhooks here ONCE (main domain).
// Verified by HMAC-SHA256 over the raw body; everything else is ignored.
//
//   order.paid / payment.captured     → one-off activation (safety net)
//   subscription.charged              → mandate renewal + receipt
//   subscription.halted               → dunning + past_due
//   subscription.cancelled/completed  → turn auto-renew off, keep paid access
//
// Every money event is idempotent through activateSubscription's txnKey, so
// Razorpay's at-least-once retries can never extend a period twice.
export async function POST(req: NextRequest) {
  const secret = process.env.BILLING_RAZORPAY_WEBHOOK_SECRET || "";
  if (!secret) return NextResponse.json({ error: "Billing webhook not configured" }, { status: 503 });

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const sig = req.headers.get("x-razorpay-signature") || "";
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (!sig || expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    try {
      await db.auditLog.create({ data: { action: "BILL_WEBHOOK_SIG_FAIL" } });
    } catch {}
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let evt: any = null;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event: string = evt?.event || "";
  const sub = evt?.payload?.subscription?.entity || {};
  const pay = evt?.payload?.payment?.entity || {};
  const order = evt?.payload?.order?.entity || {};
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  // ---- 1. One-off order paid (checkout + activate safety net) ----
  if (event === "payment.captured" || event === "order.paid") {
    // A subscription charge is handled below; don't double-process it here.
    if (pay?.subscription_id) return NextResponse.json({ ok: true, ignored: "subscription-charge" });

    let notes: Record<string, string> = order?.notes || pay?.notes || {};
    let amountPaise = Number(pay?.amount || order?.amount || 0);
    const orderId = String(order?.id || pay?.order_id || "");

    // payment.captured frequently arrives WITHOUT the order entity, so notes
    // would be empty and the safety net would silently ignore a real payment.
    // Fetch the order to recover cafeId/plan/amount before giving up.
    if (!notes.cafeId && orderId) {
      const rzp = razorpay();
      if (rzp) {
        try {
          const fetched = (await rzp.orders.fetch(orderId)) as unknown as { amount?: number; notes?: Record<string, string> };
          notes = fetched.notes || notes;
          amountPaise = amountPaise || Number(fetched.amount || 0);
        } catch { /* fall through to the ignore below */ }
      }
    }

    const cafeId: string = notes.cafeId || "";
    if (!cafeId) return NextResponse.json({ ok: true, ignored: "no-one-off-cafe" });

    const cafe = await db.cafe.findUnique({ where: { id: cafeId }, select: { id: true, name: true, ownerId: true } });
    if (!cafe) return NextResponse.json({ ok: true, ignored: "cafe-not-found" });

    const plan = parsePlan(notes.plan || "standard");
    const billing = parseBilling(notes.billing || "monthly");
    const expectedPaise = (billing === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly) * 100;

    if (amountPaise && amountPaise < expectedPaise) {
      try { await db.auditLog.create({ data: { cafeId, action: "BILL_WEBHOOK_AMOUNT_SHORT", meta: `${pay?.id || order?.id} paid=${amountPaise} expected=${expectedPaise}` } }); } catch {}
      return NextResponse.json({ ok: true, ignored: "amount-mismatch" });
    }

    if (!orderId) return NextResponse.json({ ok: true, ignored: "no-order-id" });

    const result = await activateSubscription({
      cafeId,
      plan,
      billing,
      ref: String(pay?.id || orderId),
      amount: amountPaise || expectedPaise,
      txnKey: `order:${orderId}`,
    });
    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });

    try { await db.auditLog.create({ data: { cafeId, action: "BILL_WEBHOOK_ACTIVATED", meta: `${plan} ${billing} order:${orderId}` } }); } catch {}

    const owner = cafe.ownerId
      ? await db.user.findUnique({ where: { id: cafe.ownerId }, select: { email: true, name: true } })
      : null;
    const email: string = owner?.email || notes.email || pay?.email || "";
    if (email) {
      await sendEmail({
        to: email,
        subject: `Qtable receipt — ${planLabel(plan)} ${billing} ✓`,
        html: invoiceHtml({
          name: owner?.name || "there",
          plan: planLabel(plan),
          amount: `₹${((amountPaise || expectedPaise) / 100).toLocaleString("en-IN")}`,
          period: billing === "yearly" ? "Yearly" : "Monthly",
          paymentId: String(pay?.id || "—"),
          subscriptionId: orderId,
          date,
        }),
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ---- 2. Recurring mandate charged ----
  if (event === "subscription.charged") {
    const notes = sub?.notes || pay?.notes || {};
    const cafeId: string = notes.cafeId || "";
    if (!cafeId) return NextResponse.json({ ok: true, ignored: "no-cafe" });

    const cafe = await db.cafe.findUnique({ where: { id: cafeId }, select: { id: true, ownerId: true } });
    if (!cafe) return NextResponse.json({ ok: true, ignored: "cafe-not-found" });

    const plan = parsePlan(notes.plan || "standard");
    const billing = parseBilling(notes.billing || "monthly");
    const amountPaise = Number(pay?.amount || 0);
    const expectedPaise = (billing === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly) * 100;

    // Mandates are created at the price in force at signup. If our list price
    // later changes, the customer's existing mandate still charges the ORIGINAL
    // amount — rejecting it would lock out a paying customer forever. Trust the
    // signed gateway charge, but leave an audit trail for reconciliation.
    if (amountPaise && amountPaise < expectedPaise) {
      try { await db.auditLog.create({ data: { cafeId, action: "BILL_MANDATE_LEGACY_PRICE", meta: `sub ${sub?.id} paid=${amountPaise} list=${expectedPaise}` } }); } catch {}
    }

    const subId = String(sub?.id || "");
    const payId = String(pay?.id || sub?.current_end || Date.now());
    const txnKey = `sub:${subId}:${payId}`;

    const result = await activateSubscription({
      cafeId,
      plan,
      billing,
      ref: subId,
      amount: amountPaise || expectedPaise,
      txnKey,
      mandateId: subId,
    });

    if (!result.duplicate) {
      try { await db.auditLog.create({ data: { cafeId, action: "BILL_MANDATE_CHARGED", meta: `${plan} ${billing} ${txnKey}` } }); } catch {}
      const owner = cafe.ownerId
        ? await db.user.findUnique({ where: { id: cafe.ownerId }, select: { email: true, name: true } })
        : null;
      const email: string = owner?.email || notes.email || sub?.customer?.email || "";
      if (email) {
        await sendEmail({
          to: email,
          subject: `Qtable receipt — ${planLabel(plan)} ${billing} ✓`,
          html: invoiceHtml({
            name: owner?.name || sub?.customer?.name || "there",
            plan: planLabel(plan),
            amount: `₹${((amountPaise || expectedPaise) / 100).toLocaleString("en-IN")}`,
            period: billing === "yearly" ? "Yearly" : "Monthly",
            paymentId: String(pay?.id || "—"),
            subscriptionId: subId || "—",
            date,
          }),
        });
      }
    }
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  }

  // ---- 3. Mandate failed / halted ----
  if (event === "subscription.halted" || event === "payment.failed") {
    const notes = sub?.notes || pay?.notes || order?.notes || {};
    const cafeId: string = notes.cafeId || "";
    if (cafeId) {
      const changed = await markPastDue(cafeId);
      const cafe = await db.cafe
        .findUnique({ where: { id: cafeId }, select: { ownerId: true } })
        .catch(() => null);
      const owner = cafe?.ownerId
        ? await db.user.findUnique({ where: { id: cafe.ownerId }, select: { email: true, name: true } }).catch(() => null)
        : await db.user.findFirst({ where: { cafe: { id: cafeId } }, select: { email: true, name: true } }).catch(() => null);
      const amount = `₹${(Number(pay?.amount || 0) / 100).toLocaleString("en-IN")}`;
      // Only act/log once: a retried webhook (or the cron already having moved
      // the outlet) must not spam the owner with duplicate dunning emails.
      if (changed) {
        if (owner?.email) {
          await sendEmail({
            to: owner.email,
            subject: "Qtable — your renewal needs attention ⚠️",
            html: paymentFailedHtml({ name: owner.name || "there", amount }),
          });
        }
        try { await db.auditLog.create({ data: { cafeId, action: "BILL_DUNNING_SENT", meta: `${event} ${amount}` } }); } catch {}
      }
    }
    return NextResponse.json({ ok: true });
  }

  // ---- 4. Mandate cancelled/completed: stop auto-renew, keep paid access ----
  if (event === "subscription.cancelled" || event === "subscription.completed" || event === "subscription.paused") {
    const notes = sub?.notes || {};
    const cafeId: string = notes.cafeId || "";
    if (!cafeId) return NextResponse.json({ ok: true, ignored: "no-cafe" });

    await db.cafe
      .update({ where: { id: cafeId }, data: { subAutoRenew: false } })
      .catch(() => undefined);
    // Deliberately do NOT set subStatus=canceled: the customer already paid for
    // the current period. Access continues until paid-until (+ grace).
    try {
      await db.billingEvent.create({
        data: { cafeId, kind: "canceled", plan: notes.plan || "", billing: notes.billing || "", meta: `${event} ${sub?.id || ""}` },
      });
    } catch {}
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event });
}
