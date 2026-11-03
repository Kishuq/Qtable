import crypto from "crypto";

// Google OAuth for owners (signup on first setup + login after).
// No new dependencies — plain fetch against Google's endpoints.
// Only Google-verified emails are ever trusted; accounts are never
// auto-created on login (single-outlet safety).
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function baseUrl(): string {
  // Prefer the canonical URL, but never fall back to localhost on Vercel:
  // a missing NEXT_PUBLIC_APP_URL used to send Google a localhost redirect
  // URI, which made production sign-in impossible.
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (raw) return raw;
  const host = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim();
  if (host) return `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

// Shared by auth cookies so "Secure" is set on Vercel even without APP_URL.
export function appBaseUrl(): string {
  return baseUrl();
}

export function googleCallbackUrl(): string {
  return `${baseUrl()}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export function newState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function exchangeCode(code: string): Promise<{ access_token: string }> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: googleCallbackUrl(),
    }),
  });
  if (!r.ok) throw new Error("google token exchange failed");
  return (await r.json()) as { access_token: string };
}

export async function googleProfile(accessToken: string): Promise<{ email: string; verified: boolean; name: string }> {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error("google profile fetch failed");
  const j = (await r.json()) as { email?: string; email_verified?: boolean; name?: string };
  return { email: (j.email || "").toLowerCase().trim(), verified: j.email_verified === true, name: (j.name || "").slice(0, 60) };
}
