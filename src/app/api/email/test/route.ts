import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendEmail, testEmailHtml, emailConfigured } from "@/lib/email";
import { limitRequest, tooMany } from "@/lib/security";
import { NextRequest } from "next/server";

// Lets an owner prove delivery without waiting for a real invoice:
// Settings → Email → "Send test email".
export async function GET() {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ configured: emailConfigured(), to: s.email });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await limitRequest(req, "email-test", 5, 60_000))) return tooMany();
  if (!emailConfigured()) {
    return NextResponse.json(
      { sent: false, error: "Email isn't configured — add RESEND_API_KEY in Vercel, then redeploy." },
      { status: 503 },
    );
  }
  const sent = await sendEmail({
    to: s.email,
    subject: "Qtable — email delivery test ✓",
    html: testEmailHtml(),
  });
  if (!sent) {
    return NextResponse.json(
      { sent: false, error: "Resend rejected the send. Check BILLING_EMAIL_FROM — the sender domain must be verified in Resend." },
      { status: 502 },
    );
  }
  return NextResponse.json({ sent: true, to: s.email });
}
