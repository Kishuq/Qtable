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

export function clientKey(req: NextRequest, suffix = "", scope = "") {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    // @ts-expect-error next ip
    req.ip ||
    "anon";
  return `${ip}:${req.nextUrl.pathname}:${suffix}${scope ? `:${scope}` : ""}`;
}

export function tooMany() {
  return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
}

// ---- Distributed rate limit (Upstash Redis) with in-memory fallback ----
// The in-memory buckets above reset on every serverless cold start, so they
// only slow casual abuse. When UPSTASH_REDIS_REST_URL + TOKEN are set, this
// enforces limits globally across all instances (sliding window).
//
// Limiters are cached per (url, max, window). Building a Redis client +
// Ratelimit on every request added latency to every public call, and the
// tenant guard below hits this twice.
type Limiter = { limit(key: string): Promise<{ success: boolean }> };
const limiterCache = new Map<string, Limiter>();

async function getLimiter(max: number, windowMs: number): Promise<Limiter | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) return null;

  const cacheKey = `${url}|${max}|${windowMs}`;
  const hit = limiterCache.get(cacheKey);
  if (hit) return hit;

  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(max, `${Math.max(1000, windowMs)} ms`),
      analytics: true,
      prefix: "qtable",
    }) as Limiter;
    limiterCache.set(cacheKey, limiter);
    return limiter;
  } catch {
    return null;
  }
}

export async function limitRequest(req: NextRequest, suffix: string, max = 30, windowMs = 60_000, scope = ""): Promise<boolean> {
  const limiter = await getLimiter(max, windowMs);
  if (limiter) {
    try {
      const { success } = await limiter.limit(clientKey(req, suffix, scope));
      return success;
    } catch {
      // Redis hiccup → fall through to the local limiter, never block traffic.
    }
  }
  return rateLimit(clientKey(req, suffix, scope), max, windowMs);
}

// Tenant-aware limit for public (customer) endpoints.
//
// Keying only by IP means every outlet in a mall, office park, or on the same
// carrier NAT shares ONE budget — one busy café 429s its neighbours. Here the
// outlet gets its own bucket, while a wider IP-only guard still stops a single
// device from cycling through slugs to farm unlimited requests.
export async function limitTenantRequest(
  req: NextRequest,
  suffix: string,
  tenant: string,
  max = 60,
  windowMs = 60_000,
): Promise<boolean> {
  const clean = tenant.trim().toLowerCase().slice(0, 60) || "default";
  const tenantOk = await limitRequest(req, suffix, max, windowMs, `t:${clean}`);
  if (!tenantOk) return false;
  return limitRequest(req, `${suffix}:ip`, max * 4, windowMs);
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
