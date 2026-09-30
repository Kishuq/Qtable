"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PLANS, planQuote, parseBilling, parsePlan } from "@/lib/plans";

// Razorpay payment-page URLs per plan (set in Vercel env). Empty → fallback note.
const PLAN_URLS = {
  menu: process.env.NEXT_PUBLIC_BILLING_MENU_URL || "",
  standard: process.env.NEXT_PUBLIC_BILLING_STANDARD_URL || "",
  pro: process.env.NEXT_PUBLIC_BILLING_PRO_URL || "",
};

function SubscribeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/login";
  const plan = parsePlan(sp.get("plan"));
  const billing = parseBilling(sp.get("billing"));
  const quote = planQuote(plan, billing);
  const payUrl = PLAN_URLS[plan];
  const [state, setState] = useState<{ mode: string; status: string } | null>(null);
  const [err, setErr] = useState("");

  // Auto-forward only once actually paid (active/trialing).
  // Open access (no billing configured) shows a Continue button instead of
  // silently bouncing — so the flow is visible, not mysterious.
  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        const r = await fetch("/api/billing/status", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        const b = j?.billing;
        if (!b) return;
        if (!stop) setState({ mode: b.mode, status: b.status });
        if (!stop && b.mode === "enforced" && (b.status === "active" || b.status === "trialing")) {
          router.push(next);
          router.refresh();
        }
      } catch {
        if (!stop) setErr("Could not reach billing — check connection and retry.");
      }
    }
    check();
    const t = setInterval(check, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [router, next]);

  const isOpen = state !== null && state.mode === "none";
  const isPaid = state !== null && (state.status === "active" || state.status === "trialing");
  const blocked = state !== null && !isOpen && !isPaid;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="glass rounded-3xl p-8 text-center">
        <p className="mx-auto grid size-16 place-items-center rounded-3xl bg-orange-600/15 text-3xl">💳</p>
        <h1 className="mt-4 text-2xl font-black">Subscribe to Qtable</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          Login, setup and ordering unlock <b className="text-stone-200">after</b> an active subscription.
          Complete payment and this page forwards you automatically — no refresh needed.
        </p>

        {/* Order summary — Hostinger-cart style */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm">
          <div className="flex items-center justify-between">
            <p className="font-black text-white">
              Qtable {PLANS[plan].name} <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-stone-300">{billing}</span>
            </p>
            <Link href="/#pricing" className="text-xs font-bold text-orange-400">
              Change
            </Link>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
            <span className="text-xs text-stone-400">Due today</span>
            <span className="text-2xl font-black text-white">₹{quote.total.toLocaleString("en-IN")}</span>
          </div>
          <p className="mt-1 text-right text-[11px] text-stone-500">
            ₹{quote.perMonth.toLocaleString("en-IN")}/mo • {quote.note} • UPI, cards & netbanking
          </p>
          <p className="mt-3 text-xs text-stone-400">
            Status:{" "}
            <span className="font-bold text-orange-400">
              {!state ? "checking…" : state.mode === "none" ? "open (no billing configured)" : state.status.replace("_", " ")}
            </span>
          </p>
        </div>

        {err && <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

        <div className="mt-5 grid gap-2">
          {payUrl ? (
            <a
              href={payUrl}
              className="w-full rounded-2xl bg-orange-600 py-3.5 text-center font-black text-white shadow-xl transition hover:bg-orange-500 active:scale-[.99]"
            >
              Pay ₹{quote.total.toLocaleString("en-IN")} securely →
            </a>
          ) : (
            <p className="rounded-2xl bg-amber-500/10 p-3 text-xs font-bold text-amber-200">
              Online checkout isn&apos;t linked yet — pay via the billing link shared by Qtable support, then continue below.
            </p>
          )}
          {blocked ? (
            <p className="rounded-2xl bg-amber-500/10 p-3 text-xs font-bold text-amber-200">
              ⏳ Waiting for payment… you&apos;ll move forward automatically once it&apos;s active.
            </p>
          ) : isOpen ? (
            <Link
              href={next}
              className="block w-full rounded-2xl bg-emerald-600 py-3 text-center font-bold hover:bg-emerald-500"
            >
              Continue — billing is open, no payment needed yet →
            </Link>
          ) : (
            <p className="rounded-2xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">
              ✓ Subscription active — forwarding…
            </p>
          )}
          <Link href="/" className="text-center text-sm font-bold text-orange-400">
            ← Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeInner />
    </Suspense>
  );
}
