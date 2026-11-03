import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { googleAuthUrl, googleConfigured, newState, appBaseUrl } from "@/lib/google";
import { limitRequest, tooMany } from "@/lib/security";

function back(mode: "login" | "setup", msg: string) {
  const path = mode === "setup" ? "/setup" : "/login";
  const url = new URL(path, appBaseUrl());
  url.searchParams.set("error", msg);
  return NextResponse.redirect(url);
}

// Starts Google OAuth for owners (?mode=login|setup, ?next=/dashboard).
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") === "setup" ? "setup" : "login";
  // Never dump raw JSON into the browser — send the owner back to the form
  // with a plain-English reason.
  if (!googleConfigured()) {
    return back(
      mode,
      "Google sign-in isn't switched on for this deployment yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then redeploy.",
    );
  }
  if (!(await limitRequest(req, "google", 20, 60_000))) return tooMany();

  try {
    const next = req.nextUrl.searchParams.get("next") || "/dashboard";
    const state = newState();
    const res = NextResponse.redirect(googleAuthUrl(state));
    // Bind mode+next to the CSRF state so the callback can't be steered.
    res.cookies.set("qtable_oauth", JSON.stringify({ state, mode, next }), {
      httpOnly: true,
      secure: appBaseUrl().startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (e) {
    Sentry.captureException(e);
    return back(mode, "Couldn't reach Google just now. Please try again in a moment.");
  }
}
