// Single source of truth for this outlet's public origin.
// Used by OAuth, auth cookies, password-reset links and QR generation, so a
// missing NEXT_PUBLIC_APP_URL can never leak "localhost" into production.
export function appBaseUrl(): string {
  // 1. Explicit canonical URL (what the owner set in Vercel).
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (raw) return raw;

  // 2. Vercel gives us the project's production hostname for free.
  const host = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim();
  if (host) return `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  // 3. Local development.
  return "http://localhost:3000";
}

// Absolute URL from a path — safe for emails and redirects.
export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${appBaseUrl()}${p}`;
}
