import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendEmail, invoiceHtml, paymentFailedHtml } from "@/lib/email";
import { db } from "@/lib/db";

// Platform billing webhook — point Razorpay webhooks here ONCE (main domain).
// subscription.charged → branded invoice email from Qtable.
// subscription.halted   → dunning email before the gate bites.
// Verified by HMAC-SHA256; everything else is ignored.
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
  const email: string = sub?.customer?.email || pay?.email || sub?.notes?.email || "";
  if (!email) return NextResponse.json({ ok: true, skipped: "no-email" });

  const name: string = sub?.customer?.name || pay?.notes?.name || "there";
  const amountPaise: number = Number(pay?.amount || sub?.plan?.item?.amount || 0);
  const amount = amountPaise > 0 ? `₹${(amountPaise / 100).toLocaleString("en-IN")}` : "";
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (event === "subscription.charged") {
    const planId: string = sub?.plan_id || "";
    const plan = /pro/i.test(planId) ? "Pro" : /standard|std/i.test(planId) ? "Standard" : /menu|basic/i.test(planId) ? "Basic" : "Standard";
    await sendEmail({
      to: email,
      subject: `Qtable receipt — ${plan} ${amount} paid ✓`,
      html: invoiceHtml({
        name,
        plan,
        amount,
        period: "Monthly",
        paymentId: String(pay?.id || "—"),
        subscriptionId: String(sub?.id || "—"),
        date,
      }),
    });
    try {
      await db.auditLog.create({ data: { action: "BILL_INVOICE_SENT", meta: `${email} ${amount}` } });
    } catch {}
    return NextResponse.json({ ok: true });
  }

  if (event === "subscription.halted") {
    await sendEmail({
      to: email,
      subject: "Qtable — your renewal needs attention ⚠️",
      html: paymentFailedHtml({ name, amount }),
    });
    try {
      await db.auditLog.create({ data: { action: "BILL_DUNNING_SENT", meta: email } });
    } catch {}
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event });
}
