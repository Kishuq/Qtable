import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell so Privacy and Terms read like the rest of the product
// instead of a wall of default browser text.
export function LegalShell({ title, updated, intro, children }: { title: string; updated: string; intro: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-14">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-stone-400 transition hover:text-white">
        <span className="grid size-7 place-items-center rounded-lg bg-orange-600 text-xs font-black text-white">Q</span>
        ← Back to Qtable
      </Link>

      <h1 className="mt-8 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Last updated {updated}</p>
      <p className="mt-4 text-sm leading-relaxed text-stone-400">{intro}</p>

      <div className="mt-8 space-y-4">{children}</div>

      <div className="mt-10 rounded-3xl border border-white/10 bg-white/[.03] p-6 text-sm">
        <p className="font-black text-white">Questions about this page?</p>
        <p className="mt-1 text-stone-400">
          Email{" "}
          <a className="font-bold text-orange-400 underline underline-offset-2" href={`mailto:${contactEmail()}`}>
            {contactEmail()}
          </a>{" "}
          and we&apos;ll reply within two business days.
        </p>
      </div>

      <div className="mt-6 flex gap-4 text-sm font-bold">
        <Link href="/privacy" className="text-orange-400">Privacy</Link>
        <Link href="/terms" className="text-orange-400">Terms</Link>
        <Link href="/" className="text-stone-500">Home</Link>
      </div>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[.03] p-6">
      <h2 className="text-base font-black text-white">{heading}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-stone-400">{children}</div>
    </section>
  );
}

function contactEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@qtable.in";
}
