import { NextResponse } from "next/server";
import { getBilling } from "@/lib/billing";

// ✅ Get current billing status for a cafe
// Returns the shape dashboard layout expects: { billing: {...}, portalUrl }
export async function GET() {
  const billing = await getBilling();

  return NextResponse.json({
    billing: {
      mode: billing.mode,
      status: billing.status,
      renewsAt: billing.renewsAt,
    },
    portalUrl: null,
  });
}