import { NextRequest, NextResponse } from "next/server";

// ---- Simple in-memory rate limiter (swap with Redis/Upstash in prod) ----
// Bounded: evicts oldest entries past MAX_KEYS so a flood of distinct IPs
// can never grow memory unbounded and crash the process.
const buckets = new Map<string, { count: number; reset: number }>();
const MAX_KEYS = 5000;

function evictOverflow() {
  if (buckets.size <= MAX_KEYS) return;
  const drop = buckets.size - MAX_KEYS + 500;
  let n = 0;
  for (const k of buckets.keys()) {
    buckets.delete(k);
    if (++n >= drop) break;
  }
}

export function rateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    // Opportunistic expiry sweep + overflow cap (amortised, no timers needed
    // so serverless instances never keep the event loop alive).
    if (buckets.size > MAX_KEYS) evictOverflow();
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

export function clientKey(req: NextRequest, suffix = "") {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    // @ts-expect-error next ip
    req.ip ||
    "anon";
  return `${ip}:${req.nextUrl.pathname}:${suffix}`;
}

export function tooMany() {
  return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
}

// ---- Input hygiene ----
export function cleanStr(v: unknown, max = 200): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export function cleanPhone(v: unknown): string {
  const s = cleanStr(v, 15).replace(/[^\d+]/g, "");
  return s.slice(0, 15);
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export const ORDER_STATUSES = ["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"] as const;

export function nextStatuses(s: string): string[] {
  switch (s) {
    case "NEW": return ["ACCEPTED", "CANCELLED"];
    case "ACCEPTED": return ["PREPARING", "CANCELLED"];
    case "PREPARING": return ["READY", "CANCELLED"];
    case "READY": return ["SERVED"];
    case "SERVED": return ["COMPLETED"];
    default: return [];
  }
}
