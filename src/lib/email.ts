import { Resend } from "resend";

// All Qtable mail goes through here. Unconfigured (no RESEND_API_KEY) →
// silent no-op so dev/preview never crashes on a send call.
function sender(): string {
  return process.env.BILLING_EMAIL_FROM || "Qtable Billing <billing@qtable.in>";
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY || "";
  if (!key) {
    console.warn("EMAIL_SKIP no RESEND_API_KEY", opts.to, opts.subject);
    return false;
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({ from: sender(), to: opts.to, subject: opts.subject, html: opts.html });
    if (error) {
      console.error("EMAIL_FAIL", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("EMAIL_FAIL", e instanceof Error ? e.message : e);
    return false;
  }
}

function shell(inner: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0c0a09;color:#fafaf9;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(120deg,#c2410c,#f59e0b);padding:24px;text-align:center">
      <div style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#fff">Qtable</div>
      <div style="font-size:12px;color:#fff;opacity:.85">Scan. Order. Flow.</div>
    </div>
    <div style="padding:28px">${inner}</div>
    <div style="padding:16px;text-align:center;font-size:11px;color:#a8a29e;border-top:1px solid rgba(255,255,255,.1)">
      Qtable — the digital operating system for modern food businesses.
    </div>
  </div>`;
}

// Branded receipt mailed after every successful subscription charge.
export function invoiceHtml(o: {
  name: string;
  plan: string;
  amount: string;
  period: string;
  paymentId: string;
  subscriptionId: string;
  date: string;
}): string {
  return shell(`
    <h2 style="margin:0 0 4px;font-size:22px">Payment received ✓</h2>
    <p style="color:#a8a29e;font-size:14px">Hi ${o.name}, your Qtable subscription is active. Receipt below for your records.</p>
    <table style="width:100%;margin:20px 0;font-size:14px;border-collapse:collapse">
      <tr><td style="color:#a8a29e;padding:6px 0">Plan</td><td style="text-align:right;font-weight:bold">Qtable ${o.plan}</td></tr>
      <tr><td style="color:#a8a29e;padding:6px 0">Billing period</td><td style="text-align:right">${o.period}</td></tr>
      <tr><td style="color:#a8a29e;padding:6px 0">Amount paid</td><td style="text-align:right;font-weight:bold">${o.amount}</td></tr>
      <tr><td style="color:#a8a29e;padding:6px 0">Payment ID</td><td style="text-align:right;font-family:monospace">${o.paymentId}</td></tr>
      <tr><td style="color:#a8a29e;padding:6px 0">Subscription</td><td style="text-align:right;font-family:monospace">${o.subscriptionId}</td></tr>
      <tr><td style="color:#a8a29e;padding:6px 0">Date</td><td style="text-align:right">${o.date}</td></tr>
    </table>
    <p style="font-size:13px;color:#a8a29e">Manage or cancel anytime from your dashboard → Settings. Questions? Just reply to this email.</p>
  `);
}

// Dunning mail when a renewal fails — before the gate bites.
export function paymentFailedHtml(o: { name: string; amount: string }): string {
  return shell(`
    <h2 style="margin:0 0 4px;font-size:22px">Payment needs attention ⚠️</h2>
    <p style="color:#a8a29e;font-size:14px">Hi ${o.name}, your Qtable renewal of <b style="color:#fff">${o.amount}</b> didn't go through.</p>
    <p style="font-size:14px">Update your UPI Autopay/card within 48 hours to avoid any interruption — your menu keeps serving meanwhile.</p>
    <p style="font-size:13px;color:#a8a29e">Open your dashboard → billing banner → update payment method.</p>
  `);
}

// Password reset — the only mail a signed-out owner ever needs.
// Link carries the single-use token; it expires in 24h.
export function resetPasswordHtml(o: { name: string; url: string }): string {
  return shell(`
    <h2 style="margin:0 0 4px;font-size:22px">Reset your password</h2>
    <p style="color:#a8a29e;font-size:14px">Hi ${o.name || "there"}, we received a request to reset the password for your Qtable owner account.</p>
    <p style="margin:24px 0">
      <a href="${o.url}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:14px 22px;border-radius:14px">
        Set a new password →
      </a>
    </p>
    <p style="font-size:13px;color:#a8a29e">This link works once and expires in 24 hours. If you didn't ask for a reset, ignore this email — your password stays unchanged.</p>
    <p style="font-size:12px;color:#78716c;word-break:break-all">${o.url}</p>
  `);
}

// Sent from Settings → "Send test email" so owners can verify delivery
// (and their spam folder) before a real invoice matters.
export function testEmailHtml(): string {
  return shell(`
    <h2 style="margin:0 0 4px;font-size:22px">Email delivery works ✓</h2>
    <p style="color:#a8a29e;font-size:14px">This is a test from your Qtable dashboard. Password resets and subscription receipts will land in this inbox.</p>
    <p style="font-size:13px;color:#a8a29e">Nothing else to do — you can close this email.</p>
  `);
}

