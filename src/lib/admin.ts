import { getSession, type Session } from "./auth";

// Platform operators are configured by environment, never by a database flag:
// a compromised outlet account can never promote itself to admin.
// ADMIN_EMAILS is a comma-separated list, e.g. "owner@qtable.app,ops@qtable.app".
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase().trim());
}

// Returns the signed-in operator, or null. Every /api/admin route and the
// /admin page use this — the UI is never the access control.
export async function getAdminSession(): Promise<Session | null> {
  const s = await getSession();
  if (!s || !isAdminEmail(s.email)) return null;
  return s;
}
