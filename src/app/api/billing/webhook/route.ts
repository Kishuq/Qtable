import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activateSubscription, planLabel, markPastDue } from "@/lib/billing";
import { sendEmail, invoiceHtml, paymentFailedHtml } from "@/lib/email";
import { PLANS, parseBilling, parsePlan } from "@/lib/plans";
import { platformCashfree, verifyCashfreeWebhook } from "@/lib/cashfree";

export const dynamic = "force-dynamic";

// Platform billing webhook — point the Cashfree dashboard at this URL ONCE
// (Payment Gateway → Webhooks → this endpoint; every checkout order also gets a
// notify_url stamped that points here via /api/public/pay/cashfree/webhook/<cafeId>).
// Cashfree signs with the merchant secret key (base64 HMAC-SHA256 over
// `x-webhook-timestamp + rawBody`).
//
//   PAYMENT_SUCCESS_WEBHOOK → activates the outlet's subscription (money is ours)
//   PAYMENT_FAILED_WEBHOOK   → owner is told to retry (no charge captured)
//
// Every money event is idempotent through activateSubscription's txnKey, so
// Cashfree's at-least-once retries can never extend a period twice.
export async function POST(req: NextRequest) {
  const keys = platformCashfree();
  if (!keys) return NextResponse.json({ error: "Billing webhook not configured" }, { status: 503 });

  let raw = "";
  try { raw = await req.text(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const sig = req.headers.get("x-webhook-signature") || "";
  const ts = req.headers.get("x-webhook-timestamp") || "";
  if (!verifyCashfreeWebhook(raw, ts, sig, keys.secretKey)) {
    try { await db.auditLog.create({ data: { action: "CF_WEBHOOK_SIG_FAIL" } }); } catch {}
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  type CfEvent = {
    type?: string;
    event?: string;
    data?: {
      order?: {
        order_id?: string;
        order_amount?: number | string;
        order_tags?: Record<string, string> | null;
      };
      payment?: {
        cf_payment_id?: string | number;
        payment_status?: string;
        payment_amount?: number | string;
      };
    };
  };
  let evt: CfEvent | null = null;
  try { evt = JSON.parse(raw) as CfEvent; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const event: string = String(evt?.type || evt?.event || "");
  const data = evt?.data || {};
  const order = data?.order || {};
  const payment = data?.payment || {};
  const cafeId = String(order?.order_tags?.cafeId || "");
  const plan = parsePlan(order?.order_tags?.plan || "");
  const billing = parseBilling(order?.order_tags?.billing || "");
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  // ---- Money received → activate the outlet's subscription ----
  if (event === "PAYMENT_SUCCESS_WEBHOOK" || event === "ORDER_CAPTURED") {
    if (!cafeId) return NextResponse.json({ ok: true, ignored: "no-cafe-tag" });
    // Unknown / deleted outlet: acknowledge so Cashfree stops retrying, but never
    // create a subscription row for a tenant that doesn't exist.
    const cafeExists = await db.cafe.findUnique({ where: { id: cafeId }, select: { id: true } });
    if (!cafeExists) return NextResponse.json({ ok: true, ignored: "unknown-cafe" });

    const orderRef = String(order?.order_id || "");
    const orderAmountPaise = Math.round(Number(order?.order_amount ?? payment?.payment_amount ?? 0) * 100);
    const expectedPaise = (billing === "yearly" ? PLANS[plan].yearlyTotal : PLANS[plan].monthly) * 100;

    // Never activate a payment that didn't actually land for the right amount.
    if (orderAmountPaise && orderAmountPaise < expectedPaise) {
      try { await db.auditLog.create({ data: { cafeId, action: "CF_WEBHOOK_AMOUNT_SHORT", meta: `${orderRef} paid=${orderAmountPaise} expected=${expectedPaise}` } }); } catch {}
      return NextResponse.json({ ok: true, ignored: "amount-mismatch" });
    }

    const result = await activateSubscription({
      cafeId,
      plan,
      billing,
      ref: String(payment?.cf_payment_id || orderRef),
      amount: orderAmountPaise || expectedPaise,
      txnKey: `order:${orderRef}`,
    });

    if (!result.duplicate) {
      try { await db.auditLog.create({ data: { cafeId, action: "CF_WEBHOOK_ACTIVATED", meta: `${plan} ${billing} order:${orderRef}` } }); } catch {}
      const cafe = await db.cafe.findUnique({ where: { id: cafeId }, select: { ownerId: true } });
      const owner = cafe?.ownerId
        ? await db.user.findUnique({ where: { id: cafe.ownerId }, select: { email: true, name: true } })
        : null;
      if (owner?.email) {
        await sendEmail({
          to: owner.email,
          subject: `Qtable receipt — ${planLabel(plan)} ${billing} ✓`,
          html: invoiceHtml({
            name: owner.name || "there",
            plan: planLabel(plan),
            amount: `₹${((orderAmountPaise || expectedPaise) / 100).toLocaleString("en-IN")}`,
            period: billing === "yearly" ? "Yearly" : "Monthly",
            paymentId: String(payment?.cf_payment_id || orderRef),
            subscriptionId: orderRef,
            date,
          }),
        });
      }
    }
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  }

  if (event === "PAYMENT_FAILED_WEBHOOK" || event === "PAYMENT_USER_DROPPED_WEBHOOK") {
    const failedCafeId = String(order?.order_tags?.cafeId || "");
    if (failedCafeId) {
      const cafe = await db.cafe.findUnique({
        where: { id: failedCafeId },
        select: { ownerId: true, subStatus: true, subPaidUntil: true },
      });
      if (cafe) {
        // A failed attempt (wrong OTP, abandoned checkout) must never lock out an
        // outlet that still has paid time left. Only a genuinely lapsed period
        // flips to past_due — early renewals simply retry.
        const lapsed =
          cafe.subStatus === "active" &&
          Boolean(cafe.subPaidUntil) &&
          cafe.subPaidUntil!.getTime() <= Date.now();
        const changed = lapsed ? await markPastDue(failedCafeId) : false;

        const owner = cafe.ownerId
          ? await db.user.findUnique({ where: { id: cafe.ownerId }, select: { email: true, name: true } })
          : null;
        if (owner?.email) {
          await sendEmail({
            to: owner.email,
            subject: changed ? "Qtable — your subscription has lapsed ⚠️" : "Qtable — payment didn't complete",
            html: paymentFailedHtml({ name: owner.name || "there", amount: `₹${(Number(payment?.payment_amount || 0) / 100).toLocaleString("en-IN")}` }),
          });
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Refunds / charges / anything else: acknowledged, no state change needed.
  return NextResponse.json({ ok: true, ignored: event });
}
