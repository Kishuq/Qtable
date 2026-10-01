import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured, newState } from "@/lib/google";
import { rateLimit, clientKey, tooMany } from "@/lib/security";

// Starts Google OAuth for owners (?mode=login|setup, ?next=/dashboard).
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google login isn't configured by this outlet yet." }, { status: 503 });
  }
  if (!rateLimit(clientKey(req, "google"), 20, 60_000)) return tooMany();
  const mode = req.nextUrl.searchParams.get("mode") === "setup" ? "setup" : "login";
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
