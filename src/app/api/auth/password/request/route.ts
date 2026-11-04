import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { limitRequest, tooMany, isEmail } from "@/lib/security";
import { sendEmail, resetPasswordHtml, emailConfigured } from "@/lib/email";
import { absoluteUrl } from "@/lib/url";

const Schema = z.object({ email: z.string().email().max(120) });

// Public forgot-password: always returns ok (no account enumeration).
// Creates a single-use, 24h token and emails the link. If email delivery
// isn't configured yet, the token still lands in the database so the owner
// can recover manually — but the response never reveals which case happened.
export async function POST(req: NextRequest) {
  if (!(await limitRequest(req, "pw-request", 5, 60_000))) return tooMany();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const email = p.data.email.toLowerCase().trim();
  if (!isEmail(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  try {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.user.update({ where: { email }, data: { resetToken: token, resetExpires: expires } });
      await db.auditLog.create({ data: { action: "PW_RESET_REQUEST", meta: `email=${email}` } });

      const url = absoluteUrl(
        `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
      );
      // Await so the send can't be dropped when the lambda freezes after
      // responding. No key configured → returns false immediately.
      const sent = await sendEmail({
        to: email,
        subject: "Reset your Qtable password",
        html: resetPasswordHtml({ name: user.name, url }),
      });
      if (sent) {
        await db.auditLog.create({ data: { action: "PW_RESET_EMAIL_SENT", meta: `email=${email}` } }).catch(() => {});
      } else if (!emailConfigured()) {
        console.warn("PW_RESET_NO_EMAIL_PROVIDER — token stored for manual recovery", email);
      }
    } else {
      await db.auditLog.create({ data: { action: "PW_RESET_REQUEST_MISS" } });
    }
  } catch {
    // best-effort logging only — never leak errors to the caller
  }
  return NextResponse.json({ ok: true });
}
