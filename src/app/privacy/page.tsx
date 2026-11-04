import type { Metadata } from "next";
import { LegalShell, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Qtable",
  description: "What Qtable stores, why, who processes it, and how to get it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated="4 November 2026"
      intro="Qtable is software that food businesses use to show a menu and take table orders. This page explains, in plain language, what we store, who else touches it, and how you can get it removed."
    >
      <Section heading="1. Who runs Qtable">
        <p>
          Qtable is operated by the Qtable team. Each food business (&quot;outlet&quot;) runs its own Qtable
          workspace, and the outlet decides what appears on its menu and which orders it accepts.
        </p>
      </Section>

      <Section heading="2. What we collect">
        <p>
          <b className="text-stone-200">Owner and staff accounts:</b> name, email, a securely hashed password (never
          the password itself), role, and the outlet they belong to. If you sign in with Google, we receive your
          Google account email and display name — nothing else.
        </p>
        <p>
          <b className="text-stone-200">Outlet data:</b> outlet name, tagline, menu items, prices, photos you upload,
          table codes, coupons, theme settings, UPI ID, and optional payment-gateway keys (stored encrypted).
        </p>
        <p>
          <b className="text-stone-200">Orders:</b> table code, items, amounts, order status, payment status, and — only
          if the customer chooses to type them — a first name and phone number. Customers never create an account.
        </p>
        <p>
          <b className="text-stone-200">Feedback:</b> a star rating and an optional comment, tied to the outlet and the
          order, not to a customer identity.
        </p>
        <p>
          <b className="text-stone-200">Technical data:</b> timestamps, approximate region, error reports (Sentry), and
          rate-limit counters. We do not run advertising trackers or sell data.
        </p>
      </Section>

      <Section heading="3. What we do not collect">
        <p>No customer accounts, passwords or email addresses are required to order.</p>
        <p>
          No card numbers ever reach our servers. Card and UPI details are entered on the payment gateway&apos;s own
          secure page (Razorpay or Stripe), and we only receive a confirmation reference and status.
        </p>
        <p>No location tracking, no contact-list access, no microphone or camera access.</p>
      </Section>

      <Section heading="4. Cookies and local storage">
        <p>
          <b className="text-stone-200">Session cookie:</b> keeps an owner or staff member signed in for up to 30 days.
          It is signed, HTTP-only, and marked Secure on HTTPS.
        </p>
        <p>
          <b className="text-stone-200">Remembered email:</b> the last email used on this device, so the login form is
          pre-filled. You can clear it by clearing site data.
        </p>
        <p>
          <b className="text-stone-200">Cart:</b> stored in the customer&apos;s browser (local storage) so a refresh
          doesn&apos;t lose the order. It never leaves the device until the order is placed.
        </p>
        <p>
          <b className="text-stone-200">OAuth state:</b> a short-lived cookie (10 minutes) that protects Google sign-in
          from tampering.
        </p>
      </Section>

      <Section heading="5. Who processes data for us">
        <p>We use a small, fixed set of infrastructure providers:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-stone-200">Vercel</b> — application hosting and delivery.</li>
          <li><b className="text-stone-200">Neon</b> — the PostgreSQL database that stores accounts, menus and orders.</li>
          <li><b className="text-stone-200">Upstash</b> — short-lived counters used to stop abuse and spam.</li>
          <li><b className="text-stone-200">Sentry</b> — error reports, with personal data kept out wherever possible.</li>
          <li><b className="text-stone-200">Resend</b> — transactional email such as password resets and receipts.</li>
          <li><b className="text-stone-200">Google</b> — optional owner sign-in.</li>
          <li><b className="text-stone-200">Razorpay / Stripe</b> — payment processing, when an outlet connects a gateway.</li>
        </ul>
        <p>Each provider processes data only to deliver its part of the service.</p>
      </Section>

      <Section heading="6. How long we keep data">
        <p>
          Orders, payments and feedback stay available to the outlet so it can run reports and settle accounts. Owner
          accounts stay until deleted. Password-reset tokens expire in 24 hours and are cleared once used. Rate-limit
          counters expire within minutes.
        </p>
        <p>An outlet can ask us to delete its workspace and all linked data at any time.</p>
      </Section>

      <Section heading="7. Your choices and rights">
        <p>
          You can ask for a copy of your data, correct it, or delete it. Owners can edit outlet details and menu data
          directly in the dashboard. For anything else, email us and we&apos;ll act within a reasonable period.
        </p>
        <p>
          If you believe your data was handled incorrectly, contact us first — we&apos;ll try to resolve it quickly.
          You may also have the right to complain to your local data-protection authority.
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          Passwords are hashed, sessions are signed, traffic is served over HTTPS, gateway secrets are encrypted at
          rest, and sensitive endpoints use rate limiting. No system is perfect: if we ever become aware of a breach
          affecting your data, we will tell the affected outlets without undue delay.
        </p>
      </Section>

      <Section heading="9. Children">
        <p>
          Qtable is a business tool, not a service for children. We do not knowingly collect data from anyone under 13.
        </p>
      </Section>

      <Section heading="10. Changes to this policy">
        <p>
          If this policy changes in a meaningful way, we will update the date at the top and, for significant changes,
          notify owners by email or in the dashboard.
        </p>
      </Section>
    </LegalShell>
  );
}
