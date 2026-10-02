"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Step = { target?: string; title: string; body: string; cta?: { label: string; href: string } };

const STEPS: Step[] = [
  {
    title: "Welcome to your outlet 🎉",
    body: "This 60-second tour walks the exact path your first customer will take — then shows you the counter side. Tap Next.",
  },
  {
    target: 'aside a[href="/dashboard/orders"]',
    title: "1/6 · Live orders",
    body: "Every QR scan lands here in ~3 seconds with sound + notification. Keep this tab open during service. Advance each ticket NEW → READY → SERVED.",
  },
  {
    target: 'aside a[href="/dashboard/tables"]',
    title: "2/6 · Tables & QR",
    body: "Add your tables, print tent cards from your public domain, laminate, test-scan with 2 phones. QRs carry table + theme automatically.",
  },
  {
    target: 'aside a[href="/dashboard/menu"]',
    title: "3/6 · Menu",
    body: "Dishes, photos, prices, categories. Toggle LIVE/HIDDEN to 86 an item mid-rush, ⭐ marks bestsellers, stock counts auto-hide sellouts (Pro).",
  },
  {
    target: 'aside a[href="/dashboard/settings"]',
    title: "4/6 · UPI ID — do this today",
    body: "Paste your UPI ID in Settings. That's the entire payment setup for Cash + manual UPI. Razorpay keys unlock automatic checkout later.",
  },
  {
    target: 'aside a[href="/dashboard/guide"]',
    title: "5/6 · The manual",
    body: "The full owner academy lives here — open/close routine, payments, troubleshooting. When I'm not around, this page is.",
  },
  {
    title: "You're live 🎉",
    body: "Sound on, Orders open, QRs on tables. Your first real order is minutes away.",
    cta: { label: "Open Tables & QR →", href: "/dashboard/tables" },
  },
];

const FLAG = "qtable_tour_done_v1";

function rectOf(sel?: string): DOMRect | null {
  if (!sel) return null;
  try {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return r;
  } catch {
    return null;
  }
}

export function Tour() {
  const path = usePathname();
  const router = useRouter();
  const [idx, setIdx] = useState<number | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);

  // Auto-start once, on the dashboard home only.
  useEffect(() => {
    try {
      const forced = window.location.search.includes("tour=1");
      const done = localStorage.getItem(FLAG) === "1";
      if ((forced || !done) && path === "/dashboard") {
        const t = setTimeout(() => setIdx(0), 900);
        return () => clearTimeout(t);
      }
    } catch { /* private mode */ }
  }, [path]);

  const measure = useCallback((i: number) => {
    const step = STEPS[i];
    if (!step?.target) {
      setBox(null);
      return;
    }
    const el = document.querySelector(step.target) as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Measure after the scroll settles.
    setTimeout(() => {
      setBox(rectOf(step.target));
      el?.classList.add("tour-spot");
    }, 450);
    return () => el?.classList.remove("tour-spot");
  }, []);

  useEffect(() => {
    if (idx === null) return;
    const cleanup = measure(idx);
    const onResize = () => measure(idx);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (typeof cleanup === "function") cleanup();
      document.querySelectorAll(".tour-spot").forEach((el) => el.classList.remove("tour-spot"));
    };
  }, [idx, measure]);

  function finish() {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {}
    const next = new URL(window.location.href);
    next.searchParams.delete("tour");
    window.history.replaceState(null, "", next.toString());
    setIdx(null);
  }

  if (idx === null) return null;
  const step = STEPS[idx];
  const last = idx === STEPS.length - 1;

  // Tooltip placement: below the spotlight, or centered when no target.
  const tipStyle: React.CSSProperties = box
    ? {
        top: Math.min(window.innerHeight - 260, box.bottom + 14),
        left: Math.max(12, Math.min(window.innerWidth - 332, box.left + box.width / 2 - 160)),
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={finish} />
      {box && (
        <div
          className="animate-pulse-ring absolute rounded-2xl border-2 border-orange-400"
          style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
        />
      )}
      <div className="absolute w-[320px] rounded-3xl border border-white/15 bg-stone-900 p-5 shadow-2xl" style={tipStyle}>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">
          {idx + 1} / {STEPS.length}
        </p>
        <p className="mt-1 font-black text-white">{step.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-300">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          {idx > 0 && (
            <button onClick={() => setIdx(idx - 1)} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white">
              ← Back
            </button>
          )}
          <div className="flex-1" />
          <button onClick={finish} className="px-2 py-2 text-xs font-bold text-stone-400 hover:text-white">
            Skip
          </button>
          {!last ? (
            <button onClick={() => setIdx(idx + 1)} className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-black text-white">
              Next →
            </button>
          ) : step.cta ? (
            <button
              onClick={() => {
                finish();
                router.push(step.cta!.href);
              }}
              className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-black text-white"
            >
              {step.cta.label}
            </button>
          ) : (
            <button onClick={finish} className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white">
              Done ✓
            </button>
          )}
        </div>
      </div>
      <style>{`.tour-spot{position:relative;z-index:95 !important;border-radius:16px;}`}</style>
    </div>
  );
}
