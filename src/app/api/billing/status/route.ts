import { NextResponse } from "next/server";
import { getBilling } from "@/lib/billing";

// ✅ Get current billing status for a cafe
// Returns the billing mode and status so the frontend can show appropriate UI
export async function GET() {
  const billing = await getBilling();

  // Return billing state as JSON for the dashboard
  return NextResponse.json({
    mode: billing.mode,
    status: billing.status,
    renewsAt: billing.renewsAt,
  });
}