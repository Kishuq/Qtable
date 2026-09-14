import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBilling, getPortalUrl } from "@/lib/billing";

// Owner-visible subscription state for THIS cafe's deployment.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const billing = await getBilling();
  let portalUrl: string | null = null;
  if (billing.mode === "enforced") {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    portalUrl = await getPortalUrl(host, proto);
  }
  return NextResponse.json({ billing, portalUrl });
}
