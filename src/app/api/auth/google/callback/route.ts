import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, googleProfile } from "@/lib/google";
import { setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";

function home(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return NextResponse.redirect(base ? `${base}${path}` : path);
}

// Google returns here. Never auto-creates accounts on login:
// the Google email must already belong to a verified user.
export async function GET(req: NextRequest) {
  const fail = (why: string) => home(`/login?error=${encodeURIComponent(why)}`);
  let saved: { state?: string; mode?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get("qtable_oauth")?.value || "{}");
  } catch {
    return fail("Login expired — please try again.");
  }
  const state = req.nextUrl.searchParams.get("state") || "";
  const code = req.nextUrl.searchParams.get("code") || "";
  if (!state || !saved.state || state !== saved.state || !code) {
    return fail("Login expired — please try again.");
  }
  const mode = saved.mode === "setup" ? "setup" : "login";
  const next = saved.next && saved.next.startsWith("/") ? saved.next : "/dashboard";

  let email = "";
  let name = "";
  try {
    const tok = await exchangeCode(code);
    const prof = await googleProfile(tok.access_token);
    // Only Google-verified emails are trusted. Ever.
    if (!prof.email || !prof.verified) return fail("Google couldn't verify that email.");
    email = prof.email;
    name = prof.name;
  } catch {
    return fail("Google login failed — please try again.");
  }

  if (mode === "setup") {
    // First-run signup: allowed only while no users exist (same lock as /setup).
    const existing = await db.user.count();
    if (existing > 0) return home("/login?error=Already+set+up.+Please+log+in.");
    const res = home(`/setup?gmail=${encodeURIComponent(email)}&gname=${encodeURIComponent(name)}`);
    res.cookies.set("qtable_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.verified) {
    const res = fail("No Qtable account for that Google email — finish setup first.");
    res.cookies.set("qtable_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }

  // Same strict subscription gate as password login.
  try {
    const { getBilling, isBillingBlocked } = await import("@/lib/billing");
    if (isBillingBlocked(await getBilling())) {
      const res = home(`/subscribe?next=${encodeURIComponent(next)}`);
      res.cookies.set("qtable_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
      return res;
    }
  } catch {
    // billing check itself failed → fail open
  }

  try {
    await db.auditLog.create({ data: { cafeId: user.cafeId, userId: user.id, action: "LOGIN_GOOGLE" } });
  } catch {}
  await setSessionCookie({ uid: user.id, email: user.email, role: user.role, cafeId: user.cafeId, name: user.name, verified: user.verified });
  const res = home(next);
  res.cookies.set("qtable_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
