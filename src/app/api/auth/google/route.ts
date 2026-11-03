import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured, newState } from "@/lib/google";
import { limitRequest, tooMany } from "@/lib/security";

function back(req: NextRequest, mode: "login" | "setup") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const path = mode === "setup" ? "/setup" : "/login";
  const msg = "Google sign-in isn't switched on for this deployment yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then redeploy.";
  const q = `?error=${encodeURIComponent(msg)}`;
  return NextResponse.redirect(base ? `${base}${path}${q}` : `${path}${q}`);
}

// Starts Google OAuth for owners (?mode=login|setup, ?next=/dashboard).
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") === "setup" ? "setup" : "login";
  // Never dump raw JSON into the browser — send the owner back to the form
  // with a plain-English reason.
  if (!googleConfigured()) return back(req, mode);
  if (!(await limitRequest(req, "google", 20, 60_000))) return tooMany();
  const next = req.nextUrl.searchParams.get("next") || "/dashboard";
  const state = newState();
  const res = NextResponse.redirect(googleAuthUrl(state));
  // Bind mode+next to the CSRF state so the callback can't be steered.
  res.cookies.set("qtable_oauth", JSON.stringify({ state, mode, next }), {
    httpOnly: true,
    secure: (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
