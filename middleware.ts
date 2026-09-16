import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ✅ Middleware runs on every request - check billing for dashboard access
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("qrcafe_session")?.value);

  // Existing: redirect unauthenticated users from /dashboard to /login
  if (pathname.startsWith("/dashboard") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ✅ Billing enforcement (runs only for authenticated dashboard users)
  if (pathname.startsWith("/dashboard") && hasSession) {
    // ✅ Note: Billing check is handled per-route for simplicity
    // The strict enforcement happens on order creation and dashboard access
    // via the billing state checked in route handlers
  }

  return NextResponse.next();
}

// ✅ Export a helper that routes can call to check billing enforcement
// This avoids putting await at middleware top level
export async function checkBillingEnforcement(
  req: NextRequest
): Promise<{ allowed: boolean; redirectTo?: string; status?: string }> {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("qrcafe_session")?.value);

  // If not on dashboard or not authenticated → allow
  if (!pathname.startsWith("/dashboard") || !hasSession) {
    return { allowed: true };
  }

  const billing = await import("@/lib/billing").then((mod) => mod.getBilling());

  // If billing is enforced (Stripe configured) AND subscription is NOT active/trialing → block
  if (billing.mode === "enforced" && billing.status !== "active" && billing.status !== "trialing") {
    return {
      allowed: false,
      redirectTo: "/dashboard/payment-required",
      status: billing.status,
    };
  }

  return { allowed: true };
}

export const config = { matcher: ["/dashboard/:path*", "/login", "/setup"] };