import crypto from "crypto";

// Cashfree Payment Gateway client (server-side only).
//
// Two independent tenants of the same account type live here:
//   • an outlet's own Cashfree account — collects money from diners
//   • Qtable's platform account  — collects subscription payments
//
// Everything is plain HTTPS so no SDK/extra dependency is needed. Amounts in
// Cashfree are RUPEES (decimal); our database stores paise, so every call
// converts at the boundary and never the other way round.

export type CashfreeKeys = { appId: string; secretKey: string; live: boolean };
export type CashfreeMode = "sandbox" | "production";

// Cashfree pins behaviour to a date-stamped API version.
const API_VERSION = "2023-08-01";
// A hung gateway must never hold a customer's request open. 8s is longer than
// Cashfree's p99 but short enough that the phone retries instead of spinning.
const TIMEOUT_MS = 8000;

export function modeFor(live: boolean): CashfreeMode {
  return live ? "production" : "sandbox";
}

export function cashfreeBase(live: boolean): string {
  return live ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

type CfResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

// One HTTP path to Cashfree with a hard timeout and no thrown exceptions, so
// every caller decides for itself whether to retry, degrade or surface an error.
export async function cfRequest<T>(
  keys: CashfreeKeys,
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<CfResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${cashfreeBase(keys.live)}${path}`, {
      method: init.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": keys.appId,
        "x-client-secret": keys.secretKey,
        "x-api-version": API_VERSION,
      },
      body: init.body,
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    if (!res.ok) {
      const message =
        (data as { message?: string; error?: string })?.message ||
        (data as { error?: string })?.error ||
        `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: String(message).slice(0, 200) };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error && e.name === "AbortError" ? "TIMEOUT" : "NETWORK",
    };
  } finally {
    clearTimeout(timer);
  }
}

// Cashfree requires a customer phone. Outlets often don't collect one, so a
// syntactically valid placeholder is used rather than blocking the sale; the
// real contact is always attached to the order in our own database.
function cashfreePhone(raw?: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 10) return digits;
  return "9999999999";
}

export type CreateOrderInput = {
  /** Unique per Cashfree account, alphanumeric + `_`/`-`, max 50 chars. */
  orderId: string;
  /** Amount in paise — converted to rupees for the gateway. */
  amountPaise: number;
  customer: { id: string; name?: string; email?: string; phone?: string };
  note?: string;
  tags?: Record<string, string>;
  returnUrl?: string;
  notifyUrl?: string;
};

export type CreatedOrder = { orderId: string; paymentSessionId: string; status: string };

// Creates a hosted-checkout order and returns the session id the browser hands
// to the Cashfree JS SDK. The amount is always OUR database value.
export async function createCashfreeOrder(keys: CashfreeKeys, input: CreateOrderInput): Promise<CreatedOrder> {
  const rupees = Math.round(input.amountPaise) / 100;
  if (!(rupees >= 1)) throw new Error("CASHFREE_AMOUNT_TOO_SMALL");

  const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const body: Record<string, unknown> = {
    order_id: input.orderId,
    order_amount: Number(rupees.toFixed(2)),
    order_currency: "INR",
    order_expiry_time: expiry,
    customer_details: {
      customer_id: (input.customer.id || "guest").slice(0, 50),
      customer_name: (input.customer.name || "Guest").slice(0, 100),
      ...(input.customer.email ? { customer_email: input.customer.email.slice(0, 200) } : {}),
      customer_phone: cashfreePhone(input.customer.phone),
    },
    ...(input.returnUrl || input.notifyUrl
      ? {
          order_meta: {
            ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
            ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
          },
        }
      : {}),
    ...(input.note ? { order_note: input.note.slice(0, 200) } : {}),
    ...(input.tags ? { order_tags: input.tags } : {}),
  };

  const r = await cfRequest<{
    order_id?: string;
    order_status?: string;
    order_amount?: number | string;
    order_tags?: Record<string, string> | null;
    payment_session_id?: string;
  }>(keys, "/orders", { method: "POST", body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`CASHFREE_CREATE_${r.status || "NETWORK"}: ${r.error}`);
  if (!r.data?.payment_session_id) throw new Error("CASHFREE_NO_PAYMENT_SESSION");
  return {
    orderId: String(r.data.order_id || input.orderId),
    paymentSessionId: String(r.data.payment_session_id),
    status: String(r.data.order_status || "ACTIVE"),
  };
}

export type CashfreeOrder = {
  orderId: string;
  /** ACTIVE | PAID | EXPIRED | TERMINATED | PARTIALLY_PAID */
  status: string;
  amountPaise: number;
  tags: Record<string, string>;
  paymentId: string;
};

// Server-to-server truth. This is the ONLY thing allowed to mark money as
// received — a browser redirect proves nothing on its own.
export async function getCashfreeOrder(keys: CashfreeKeys, orderId: string): Promise<CashfreeOrder | null> {
  const r = await cfRequest<{
    order_id?: string;
    order_status?: string;
    order_amount?: number | string;
    order_tags?: Record<string, string> | null;
    payments?: Array<{ cf_payment_id?: string | number; payment_status?: string }>;
  }>(keys, `/orders/${encodeURIComponent(orderId)}`);
  if (!r.ok) return null;
  const d = r.data || {};
  const paid = (d.payments || []).find((p) => p.payment_status === "SUCCESS");
  return {
    orderId: String(d.order_id || orderId),
    status: String(d.order_status || "").toUpperCase(),
    amountPaise: Math.round(Number(d.order_amount || 0) * 100),
    tags: (d.order_tags || {}) as Record<string, string>,
    paymentId: paid?.cf_payment_id ? String(paid.cf_payment_id) : "",
  };
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Cashfree signs webhooks with the merchant's SECRET KEY (there is no separate
// webhook secret): base64(HMAC-SHA256(timestamp + rawBody, secretKey)).
export function verifyCashfreeWebhook(
  rawBody: string,
  timestamp: string,
  signature: string,
  secretKey: string,
): boolean {
  if (!rawBody || !timestamp || !signature || !secretKey) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(`${timestamp}${rawBody}`).digest("base64");
  // Some dashboard setups hand out the hex digest; accept either, still constant-time.
  const expectedHex = crypto.createHmac("sha256", secretKey).update(`${timestamp}${rawBody}`).digest("hex");
  return safeEqual(expected, signature) || safeEqual(expectedHex, signature);
}

// Qtable's own Cashfree account (NOT an outlet's). Missing keys simply mean
// self-serve checkout is unavailable and the subscribe page says so.
export function platformCashfree(): CashfreeKeys | null {
  const appId = (process.env.BILLING_CASHFREE_APP_ID || "").trim();
  const secretKey = (process.env.BILLING_CASHFREE_SECRET_KEY || "").trim();
  if (!appId || !secretKey) return null;
  const flags = (process.env.BILLING_CASHFREE_ENV || "").trim().toLowerCase();
  // Default to live in production: if sandbox keys were pasted by mistake the
  // gateway rejects them loudly instead of silently accepting fake money.
  const live = flags ? flags === "production" || flags === "live" : process.env.NODE_ENV === "production";
  return { appId, secretKey, live };
}

// Short, Cashfree-safe unique order id (<= 50 chars, [A-Za-z0-9_-]).
export function cashfreeOrderId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 26)}`;
}
