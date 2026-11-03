import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap check only: cookie presence decides the *routing* nudge. The real
// signature check happens server-side (getSession / requireOwner), so a stale
// cookie simply lands on /login instead of leaking any data.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("qrcafe_session")?.value);

  // Redirect unauthenticated users from /dashboard to /login
  if (pathname.startsWith("/dashboard") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/login", "/setup"] };
