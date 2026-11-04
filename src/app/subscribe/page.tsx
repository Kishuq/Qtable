"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PLANS, planQuote, parseBilling, parsePlan, type Billing, type PlanId } from "@/lib/plans";

// Hosted payment-page links per plan (optional fallback when the platform
// Razorpay Order API isn't configured on this deployment).
const PLAN_URLS: Record<PlanId, string> = {
  menu: process.env.NEXT_PUBLIC_BILLING_MENU_URL || "",
  standard: process.env.NEXT_PUBLIC_BILLING_STANDARD_URL || "",
  pro: process.env.NEXT_PUBLIC_BILLING_PRO_URL || "",
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
};

function loadRazorpay(): Promise<boolean> {
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function SubscribeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const [plan, setPlan] = useState<PlanId>(parsePlan(sp.get("plan")));
  const [billing, setBilling] = useState<Billing>(parseBilling(sp.get("billing")));
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const quote = planQuote(plan, billing);

  // Poll while unpaid: activation can land via the webhook even if the browser
  // lost the callback, and the owner should move forward without refreshing.
  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        const r = await fetch("/api/billing/status", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        if (!j || j.error || stop) return;
        setStatus(j);
        if (j.active) {
          router.push(next);
          router.refresh();
        }
      } catch {
        if (!stop) setErr("Couldn't reach billing — check your connection.");
      }
    }
    check();
    const t = setInterval(check, 6000);
    return () => { stop = true; clearInterval(t); };
  }, [router, next]);

  async function pay() {
    setErr("");
    setNote("");
    setBusy(true);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/subscribe?plan=${plan}&billing=${billing}&next=${next}`)}`);
        return;
      }
      if (!r.ok || !j.orderId) {
        if (j.fallback) {
          const url = PLAN_URLS[plan];
          if (url) {
            window.location.href = url;
            return;
          }
          setNote(
            "Online checkout isn't connected yet. Pay using the link from Qtable support, then reload this page — access unlocks automatically.",
          );
          return;
        }
        throw new Error(j.error || "Couldn't start checkout");
      }

      if (!(await loadRazorpay())) throw new Error("Payment popup couldn't load — check your connection and try again.");
      const RZP = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open(): void } }).Razorpay;
      const rz = new RZP({
        key: j.keyId,
        order_id: j.orderId,
        amount: j.amount,
        currency: j.currency || "INR",
        name: j.name || "Qtable",
        description: j.description || `${PLANS[plan].name} — ${billing}`,
        prefill: j.prefill || {},
        theme: { color: "#c2410c" },
        handler: async (resp: unknown) => {
          const d = resp as { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
          try {
            const vr = await fetch("/api/billing/activate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(d),
            });
            const vj = await vr.json().catch(() => ({}));
            if (!vr.ok) throw new Error(vj.error || "Payment received, but activation is still confirming.");
            router.push(next);
            router.refresh();
          } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : "Payment received — waiting for confirmation.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => { setBusy(false); setNote("Checkout closed — nothing was charged. Try again whenever you're ready."); } },
      });
      rz.open();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Couldn't start checkout");
      setBusy(false);
    }
  }

  const isActive = status?.active === true;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-12">
      <div className="text-center">
        <p className="mx-auto grid size-14 place-items-center rounded-2xl bg-orange-600/15 text-2xl">💳</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Choose your plan</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-stone-400">
          Your outlet is in preview mode — everything is built and visible. Subscribe to publish the menu, print table
          QRs and start taking orders.
        </p>
        {status?.cafe && (
          <p className="mt-3 inline-flex rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-stone-300">
            {status.cafe.name} · /t/{status.cafe.slug}
          </p>
        )}
      </div>

      {/* Billing period */}
      <div className="mx-auto mt-7 flex w-fit rounded-full bg-white/5 p-1">
        {(["monthly", "yearly"] as Billing[]).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            className={`rounded-full px-5 py-2 text-xs font-black transition active:scale-95 ${
              billing === b ? "bg-orange-600 text-white shadow" : "text-stone-400 hover:text-white"
            }`}
          >
            {b === "monthly" ? "Monthly" : "Yearly · save ~20%"}
          </button>
        ))}
      </div>

      {/* Plans */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const q = planQuote(id, billing);
          const selected = plan === id;
          return (
            <button
              key={id}
              onClick={() => setPlan(id)}
              className={`relative rounded-3xl border p-5 text-left transition active:scale-[.99] ${
                selected
                  ? "border-orange-500 bg-gradient-to-b from-orange-600/20 to-transparent shadow-xl"
                  : "border-white/10 bg-white/[.03] hover:border-white/25"
              }`}
            >
              {id === "standard" && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-orange-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                  Most popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <p className={`text-sm font-black ${selected ? "text-orange-300" : "text-stone-300"}`}>{p.name}</p>
                <span className={`grid size-5 place-items-center rounded-full border text-[10px] ${selected ? "border-orange-400 bg-orange-500 text-white" : "border-white/25 text-transparent"}`}>✓</span>
              </div>
              <p className="mt-1.5 text-2xl font-black text-white">
                ₹{q.perMonth.toLocaleString("en-IN")}
                <span className="text-xs font-bold text-stone-500">/mo</span>
              </p>
              <p className="text-[11px] text-stone-500">{q.note}</p>
              <p className="mt-2 text-xs leading-relaxed text-stone-400">{p.blurb}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-stone-300">
                {p.features.map((t) => (
                  <li key={t} className="flex gap-1.5">
                    <span className="text-emerald-300">✓</span> {t}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Checkout summary */}
      <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/[.03] p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="font-black text-white">
              Qtable {PLANS[plan].name}{" "}
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-stone-300">{billing}</span>
            </p>
            <p className="mt-0.5 text-xs text-stone-400">{quote.note} · UPI, cards & netbanking</p>
          </div>
          <p className="text-2xl font-black text-white">₹{quote.total.toLocaleString("en-IN")}</p>
        </div>

        {err && <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
        {note && <p className="mt-3 rounded-2xl bg-amber-500/10 p-3 text-sm text-amber-200">{note}</p>}

        <button
          onClick={pay}
          disabled={busy || isActive}
          className="mt-4 w-full rounded-2xl bg-orange-600 py-3.5 font-black text-white shadow-xl transition hover:bg-orange-500 active:scale-[.99] disabled:opacity-60"
        >
          {isActive ? "✓ Already subscribed" : busy ? "Opening secure checkout…" : `Pay ₹${quote.total.toLocaleString("en-IN")} securely →`}
        </button>

        {status && !status.checkout && (
          <p className="mt-2 text-center text-[11px] text-stone-500">
            Card/UPI checkout goes live once Qtable billing keys are configured. Until then use the payment link from
            support.
          </p>
        )}
        {isActive && (
          <Link href={next} className="mt-2 block text-center text-sm font-bold text-emerald-300">
            Continue to dashboard →
          </Link>
        )}
        <p className="mt-3 text-center text-[11px] leading-relaxed text-stone-500">
          Cancel anytime. Access continues until the end of the period you paid for.{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-stone-300">Terms</Link>
        </p>
      </div>

      <div className="mt-6 flex justify-center gap-4 text-sm font-bold">
        <Link href="/" className="text-stone-400 hover:text-white">← Back home</Link>
        {!isActive && <Link href="/dashboard" className="text-orange-400">Keep browsing preview →</Link>}
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
