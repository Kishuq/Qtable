"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPARE, PLANS, planQuote, type Billing, type PlanId } from "@/lib/plans";
import { Reveal } from "./Reveal";

const ORDER: PlanId[] = ["menu", "standard", "pro"];

function discount(mrp: number, price: number) {
  return Math.round(((mrp - price) / mrp) * 100);
}

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div>
      {/* Billing-period toggle, Hostinger-style */}
      <div className="mt-6 flex justify-center">
        <div className="flex rounded-full border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Billing period">
          {(["monthly", "yearly"] as const).map((b) => (
            <button
              key={b}
              role="tab"
              aria-selected={billing === b}
              onClick={() => setBilling(b)}
              className={`rounded-full px-6 py-2 text-xs font-black transition active:scale-95 ${
                billing === b ? "bg-orange-600 text-white shadow-lg" : "text-stone-400 hover:text-white"
              }`}
            >
              {b === "monthly" ? "Monthly" : "Yearly −20%"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid items-stretch gap-3 text-left md:grid-cols-3">
        {ORDER.map((id, i) => {
          const p = PLANS[id];
          const q = planQuote(id, billing);
          const hot = id === "standard";
          const href = `/subscribe?plan=${id}&billing=${billing}&next=/setup`;
          return (
            <Reveal key={id} delay={i * 90} className="h-full">
              <div
                className={`relative flex h-full flex-col p-7 ${
                  hot
                    ? "rounded-3xl border border-orange-500/50 bg-gradient-to-b from-orange-600/15 to-transparent shadow-2xl"
                    : "rounded-3xl border border-white/10 bg-white/[.03]"
                }`}
              >
                {hot && (
                  <span className="absolute -top-3 left-6 rounded-full bg-orange-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    Most popular
                  </span>
                )}
                <span
                  className={`w-fit rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                    hot ? "bg-orange-600/20 text-orange-300" : "bg-white/10 text-stone-300"
                  }`}
                >
                  {billing === "yearly" ? "Save 20% yearly" : `${discount(p.mrp, p.monthly)}% off launch price`}
                </span>
                <p className={`mt-3 text-sm font-black ${hot ? "text-orange-300" : "text-stone-300"}`}>{p.name}</p>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-stone-500 line-through">₹{p.mrp.toLocaleString("en-IN")}</span>
                  <span className="text-4xl font-black text-white">₹{q.perMonth.toLocaleString("en-IN")}</span>
                  <span className="text-base font-bold text-stone-500">/mo</span>
                </p>
                <p className="mt-1 text-xs font-bold text-stone-400">
                  {billing === "yearly" ? `₹${q.total.toLocaleString("en-IN")} billed yearly` : "billed monthly"} • {p.blurb}
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-stone-300">
                  {p.features.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-emerald-300">✓</span> {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`mt-6 block rounded-2xl py-3 text-center text-sm font-black transition active:scale-[.98] ${
                    hot
                      ? "bg-orange-600 text-white shadow-xl hover:bg-orange-500"
                      : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  Choose plan →
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>
      <Reveal delay={140}>
        <p className="mt-5 text-center text-xs text-stone-500">
          Cancel anytime • UPI, cards & netbanking • Ordering never stops mid-service
        </p>
      </Reveal>

      {/* Feature comparison — exactly what each tier unlocks in the product */}
      <Reveal delay={120}>
        <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-3xl border border-white/10">
          <div className="grid grid-cols-[1fr_repeat(3,64px)] items-center gap-1 bg-white/[.04] px-4 py-3 text-center text-[11px] font-black sm:grid-cols-[1fr_repeat(3,90px)]">
            <span className="text-left text-stone-400">Compare plans</span>
            <span className="text-stone-200">Menu</span>
            <span className="text-orange-300">Std.</span>
            <span className="text-stone-200">Pro</span>
          </div>
          {COMPARE.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-[1fr_repeat(3,64px)] items-center gap-1 px-4 py-2.5 text-center text-xs sm:grid-cols-[1fr_repeat(3,90px)] ${
                i % 2 ? "bg-white/[.02]" : ""
              }`}
            >
              <span className="text-left font-bold text-stone-300">{r.label}</span>
              {([r.menu, r.standard, r.pro] as boolean[]).map((v, k) => (
                <span key={k} className={v ? "text-base text-emerald-300" : "text-base text-stone-700"}>
                  {v ? "✓" : "—"}
                </span>
              ))}
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}
