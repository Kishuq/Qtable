import type { Metadata } from "next";
import { LegalShell, Section } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Qtable",
  description: "The agreement between Qtable and the food businesses that use it.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      updated="4 November 2026"
      intro="These terms cover your use of Qtable as an outlet owner or staff member. They are written to be readable — if anything is unclear, ask us before you subscribe."
    >
      <Section heading="1. The agreement">
        <p>
          By creating an outlet or signing in, you agree to these terms on behalf of the business you represent. If you
          do not agree, please do not use the service.
        </p>
      </Section>

      <Section heading="2. What Qtable is">
        <p>
          Qtable is software for food businesses: a digital menu customers open by scanning a table QR code, table
          ordering, a live orders board, payments, tables, design themes, and optional Pro modules such as inventory,
          offers, staff logins and analytics.
        </p>
        <p>
          Qtable is not a restaurant, a payment processor, or a delivery service. The outlet is responsible for the
          food, pricing, taxes, hygiene, licences and service it provides.
        </p>
      </Section>

      <Section heading="3. Accounts and security">
        <p>
          You are responsible for keeping owner and staff credentials safe, and for what happens under those accounts.
          Tell us immediately if you suspect unauthorised access.
        </p>
        <p>
          One workspace represents one outlet. Staff accounts should be personal; do not share a single login across
          several people.
        </p>
      </Section>

      <Section heading="4. Plans, billing and cancellation">
        <p>
          Plans are billed per outlet, monthly or yearly, in advance. The price shown at checkout is the price that
          applies for that billing period; renewals continue until you cancel.
        </p>
        <p>
          You can cancel at any time and keep access until the end of the period you already paid for. Unless the law
          requires otherwise, partial periods are not refunded. If a renewal fails, we may pause ordering until payment
          is updated, and we will email you before that happens.
        </p>
        <p>
          Plan features are enforced by the software. Downgrading may hide modules and disable ordering, but your menu,
          orders and reports stay in your workspace.
        </p>
      </Section>

      <Section heading="5. Payments from your customers">
        <p>
          Money from customers goes directly to the payment account you connect (for example your own Razorpay
          account). Qtable does not hold customer funds and does not settle them.
        </p>
        <p>
          If you accept cash or a manual UPI transfer, confirming that payment is your responsibility. The
          &quot;I&apos;ve paid&quot; tap from a customer is a claim, not a bank confirmation.
        </p>
      </Section>

      <Section heading="6. Acceptable use">
        <p>Do not use Qtable to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>sell unlawful goods or services, or misrepresent what you sell;</li>
          <li>upload malware, or content you do not have the right to use;</li>
          <li>probe, overload, scrape or bypass the security and rate limits of the service;</li>
          <li>collect customer data for purposes the customer did not expect.</li>
        </ul>
        <p>We may suspend a workspace that puts other outlets, customers or the platform at risk.</p>
      </Section>

      <Section heading="7. Availability and support">
        <p>
          We work to keep Qtable available and fast, but we do not promise uninterrupted service. Maintenance, provider
          outages and network problems can cause downtime. If something breaks, contact support — we prioritise issues
          that stop a live service.
        </p>
        <p>
          We may improve or change features. We will not remove a feature you actively rely on for a paid period without
          a reasonable notice period.
        </p>
      </Section>

      <Section heading="8. Your data and content">
        <p>
          Your menu, photos, prices, orders and reports belong to you. You grant us permission to store and display them
          only to operate the service. We do not sell your data or use your menu content to advertise other outlets.
        </p>
        <p>
          You confirm you have the rights to the photos and text you upload. Our handling of personal data is described
          in the Privacy Policy.
        </p>
      </Section>

      <Section heading="9. Intellectual property">
        <p>
          Qtable&apos;s software, design system, themes and brand remain ours. Your subscription gives you a limited,
          non-transferable right to use the service for your outlet; it does not transfer ownership.
        </p>
      </Section>

      <Section heading="10. Limits of liability">
        <p>
          To the extent the law allows, Qtable is not liable for indirect losses such as lost profit, lost goodwill or
          lost data, and our total liability for a claim is limited to the amount you paid us in the three months before
          the claim.
        </p>
        <p>Nothing here excludes liability that cannot legally be excluded.</p>
      </Section>

      <Section heading="11. Ending the agreement">
        <p>
          You may stop using Qtable at any time. We may end the agreement if these terms are seriously or repeatedly
          broken, or if an account is used to harm others. On request, we will export or delete your workspace data.
        </p>
      </Section>

      <Section heading="12. Governing law">
        <p>
          These terms are governed by the laws of India. Disputes will first be taken up with us in good faith; if that
          fails, they fall to the courts at our principal place of business in India.
        </p>
      </Section>

      <Section heading="13. Changes to these terms">
        <p>
          We may update these terms as the product evolves. The date at the top always shows the current version, and
          significant changes are announced by email or in the dashboard before they take effect.
        </p>
      </Section>
    </LegalShell>
  );
}
