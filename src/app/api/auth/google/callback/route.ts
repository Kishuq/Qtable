import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, googleProfile, appBaseUrl } from "@/lib/google";
import { setSessionCookie, signGoogleSignup, GOOGLE_SIGNUP_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";

// Always an absolute URL: NextResponse.redirect throws on relative paths,
// which is what produced raw 500s when NEXT_PUBLIC_APP_URL was unset.
function home(path: string) {
  return NextResponse.redirect(new URL(path, appBaseUrl()));
}

// Google returns here. Never auto-creates accounts on login:
// the Google email must already belong to a verified user.
export async function GET(req: NextRequest) {
  const fail = (why: string) => home(`/login?error=${encodeURIComponent(why)}`);
  // Google sends ?error=... when the person cancels the consent screen or the
  // app blocks the account (e.g. it's still in Testing and the Gmail isn't a
  // test user). Say that plainly instead of calling it "expired".
  const googleError = req.nextUrl.searchParams.get("error") || "";
  if (googleError) {
    const why =
      googleError === "access_denied"
        ? "Google blocked this sign-in. If the app is still in Testing, add your Gmail under Google Auth Platform → Audience → Test users, then try again."
        : "Google couldn't complete the sign-in. Please try again in a moment.";
    const res = fail(why);
    res.cookies.set("qtable_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
  }
  let saved: { state?: string; mode?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get("qtable_oauth")?.value || "{}");
  } catch {
    return fail("Sign-in timed out. Tap Continue with Google again — keep it in this same tab.");
  }
  const state = req.nextUrl.searchParams.get("state") || "";
  const code = req.nextUrl.searchParams.get("code") || "";
  if (!state || !saved.state || state !== saved.state || !code) {
    // Causes: the link was refreshed, two sign-in attempts ran in different
    // tabs (the later one overwrote the first), or a different browser
    // finished the flow. Restarting in one tab always fixes it.
    return fail("Sign-in timed out or was started in another tab. Tap Continue with Google again.");
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
    // Hand the verified identity to /setup in a signed, httpOnly cookie —
    // no email in the URL, no password to type, no retyping.
    const res = home("/setup?google=1");
    res.cookies.set(GOOGLE_SIGNUP_COOKIE, signGoogleSignup({ email, name }), {
      httpOnly: true,
      secure: appBaseUrl().startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
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
