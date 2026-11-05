"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionTitle, EmptyState } from "@/components/ux";
import { inr, fdate } from "@/lib/format";

type Event = {
  id: string;
  kind: string;
  plan: string;
  billing: string;
  amount: number;
  ref: string;
  createdAt: string;
};

type Status = {
  plan: string;
  status: string;
  billing: string;
  active: boolean;
  preview: boolean;
  paidUntil: string | null;
  checkout: boolean;
  cafe: { name: string; slug: string } | null;
  events: Event[];
};

const LABEL: Record<string, { text: string; tone: string }> = {
  signup: { text: "Account created", tone: "bg-white/10 text-stone-300" },
  activated: { text: "Subscription started", tone: "bg-emerald-500/15 text-emerald-300" },
  renewal: { text: "Renewed", tone: "bg-emerald-500/15 text-emerald-300" },
  expired: { text: "Period ended", tone: "bg-red-500/15 text-red-300" },
  canceled: { text: "Canceled", tone: "bg-amber-500/15 text-amber-200" },
  refund: { text: "Refunded", tone: "bg-sky-500/15 text-sky-300" },
  reminder: { text: "Renewal reminder sent", tone: "bg-white/10 text-stone-300" },
};

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export default function BillingPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const r = await fetch("/api/billing/status", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!stop && j && !j.error) setStatus(j);
      } catch {
        if (!stop) setErr("Couldn't load billing — check your connection.");
      }
    }
    load();
    const t = setInterval(load, 15_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  const left = daysLeft(status?.paidUntil ?? null);
  const active = status?.active === true;
  const renewHref = `/subscribe?plan=${status?.plan || "standard"}&billing=${status?.billing || "monthly"}`;

  return (
    <div>
      <SectionTitle title="Billing & receipts 💳" sub="Your plan, renewal date, and every payment on record." />

      {err && <p className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="glass rounded-3xl p-5 md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-stone-500">Current plan</p>
              <p className="mt-1 text-2xl font-black capitalize">
                Qtable {status ? (status.plan === "menu" ? "Basic" : status.plan === "pro" ? "Pro" : "Standard") : "—"}
              </p>
              <p className="mt-1 text-sm text-stone-400">
                {status?.cafe ? `${status.cafe.name} · /t/${status.cafe.slug}` : "—"}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${active ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
              {active ? "Active" : status?.status === "past_due" ? "Payment due" : "Preview"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/[.04] p-4">
              <p className="text-xs text-stone-500">Billing cycle</p>
              <p className="mt-1 font-black capitalize">{status?.billing || "monthly"}</p>
            </div>
            <div className="rounded-2xl bg-white/[.04] p-4">
              <p className="text-xs text-stone-500">Paid until</p>
              <p className="mt-1 font-black">
                {status?.paidUntil ? fdate(status.paidUntil) : "—"}
                {left !== null && active && (
                  <span className={`ml-2 text-xs font-bold ${left <= 3 ? "text-amber-300" : "text-stone-400"}`}>
                    {left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "due today"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href={renewHref} className="rounded-2xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-orange-500 active:scale-[.98]">
              {active ? "Extend / change plan →" : "Subscribe now →"}
            </Link>
            <Link href="/subscribe" className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/15">
              Compare plans
            </Link>
            {status && !status.checkout && (
              <span className="text-[11px] text-stone-500">Online checkout goes live once platform billing keys are configured.</span>
            )}
          </div>
        </div>

        <div className="glass rounded-3xl p-5">
          <p className="text-xs font-black uppercase tracking-widest text-stone-500">How renewal works</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            Renewing early extends your paid period — you never lose days. We email a reminder 3 days before the period
            ends. If a payment isn&apos;t made, the outlet switches to preview mode: your menu and data stay safe, ordering
            pauses until you renew.
          </p>
          <p className="mt-3 text-xs text-stone-500">Need an invoice for accounting? Every receipt is emailed, and the ledger below is your record.</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-black">Payment history</p>
        <div className="glass overflow-hidden rounded-3xl">
          {!status ? (
            <p className="p-6 text-sm text-stone-500">Loading…</p>
          ) : status.events.length === 0 ? (
            <EmptyState emoji="🧾" title="No billing activity yet" hint="Your plan history will appear here after your first payment." />
          ) : (
            <ul className="divide-y divide-white/5">
              {status.events.map((e) => {
                const meta = LABEL[e.kind] || { text: e.kind, tone: "bg-white/10 text-stone-300" };
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${meta.tone}`}>{meta.text}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {e.kind === "signup" ? "Preview account" : `${e.plan ? e.plan.toUpperCase() : ""} ${e.billing || ""}`.trim() || "—"}
                      </p>
                      <p className="truncate text-[11px] text-stone-500">
                        {fdate(e.createdAt)}
                        {e.ref ? ` · ${e.ref}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-black">{e.amount > 0 ? inr(e.amount) : "—"}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
