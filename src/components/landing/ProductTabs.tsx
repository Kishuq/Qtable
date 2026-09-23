"use client";

import { useState } from "react";

const TABS = ["Customer", "Orders", "Kitchen", "Tables", "Menu", "Analytics"] as const;
type Tab = (typeof TABS)[number];

function Panel({ tab }: { tab: Tab }) {
  if (tab === "Customer")
    return (
      <div className="mx-auto w-full max-w-xs rounded-[28px] border border-white/10 bg-stone-950 p-4">
        {[
          ["Signature Cappuccino", "₹180", "☕"],
          ["Peri-Peri Fries", "₹129", "🍟"],
          ["Mango Smoothie", "₹149", "🥭"],
        ].map(([n, p, e]) => (
          <div key={n} className="mb-2 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-xl">{e}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white">{n}</p>
              <p className="text-[11px] font-bold text-orange-400">{p}</p>
            </div>
            <span className="rounded-full bg-orange-600 px-3 py-1 text-[10px] font-black text-white">ADD</span>
          </div>
        ))}
        <div className="rounded-2xl bg-orange-600 py-2.5 text-center text-xs font-black text-white">Cart • ₹458 →</div>
      </div>
    );
  if (tab === "Orders")
    return (
      <div className="mx-auto w-full max-w-md space-y-2">
        {[
          ["#104", "T12", "PREPARING", true],
          ["#103", "T4", "NEW", true],
          ["#102", "T7", "READY", false],
          ["#101", "T2", "SERVED", false],
        ].map(([id, t, s, hot]) => (
          <div
            key={id as string}
            className={`flex items-center justify-between rounded-2xl border p-3 ${
              hot ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-white/5"
            }`}
          >
            <p className="text-xs font-black text-white">
              {id} • Table {t}
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                s === "NEW" ? "bg-sky-500/20 text-sky-300" : s === "PREPARING" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
              }`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    );
  if (tab === "Kitchen")
    return (
      <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2">
        {[
          ["#104", "04:12", true],
          ["#103", "01:48", true],
          ["#102", "00:32", false],
          ["#099", "done", false],
        ].map(([id, t, hot]) => (
          <div key={id as string} className={`rounded-2xl border p-4 text-center ${hot ? "border-amber-500/40 bg-amber-500/10" : "border-white/10 bg-white/5"}`}>
            <p className="text-sm font-black text-white">{id}</p>
            <p className={`mt-1 font-mono text-xl font-black ${hot ? "text-amber-300" : "text-stone-500"}`}>{t}</p>
          </div>
        ))}
      </div>
    );
  if (tab === "Tables")
    return (
      <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
        {[
          ["T1", "bg-emerald-500/20 text-emerald-300", "Free"],
          ["T2", "bg-amber-500/20 text-amber-300", "Busy"],
          ["T3", "bg-orange-500/20 text-orange-300", "Order"],
          ["T4", "bg-emerald-500/20 text-emerald-300", "Free"],
          ["T5", "bg-sky-500/20 text-sky-300", "Hold"],
          ["T6", "bg-amber-500/20 text-amber-300", "Busy"],
          ["T7", "bg-emerald-500/20 text-emerald-300", "Free"],
          ["T8", "bg-orange-500/20 text-orange-300", "Order"],
        ].map(([t, c, s]) => (
          <div key={t as string} className={`rounded-2xl ${c} p-3 text-center`}>
            <p className="text-sm font-black">{t}</p>
            <p className="text-[10px] font-bold opacity-80">{s}</p>
          </div>
        ))}
      </div>
    );
  if (tab === "Menu")
    return (
      <div className="mx-auto w-full max-w-md space-y-2">
        {[
          ["Coffee", "12 items", true],
          ["Snacks", "8 items", true],
          ["Desserts", "5 items", false],
          ["Coolers", "6 items", true],
        ].map(([n, c, on]) => (
          <div key={n as string} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-xs font-black text-white">{n}</p>
              <p className="text-[10px] text-stone-500">{c}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black ${on ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-stone-400"}`}>
              {on ? "Live" : "Hidden"}
            </span>
          </div>
        ))}
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/[.03] p-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ["₹42,850", "+18.4%", "Revenue"],
          ["142", "today", "Orders"],
          ["₹302", "avg", "Avg order"],
        ].map(([v, s, l]) => (
          <div key={l as string}>
            <p className="text-lg font-black text-white">{v}</p>
            <p className="text-[10px] font-bold text-emerald-300">{s}</p>
            <p className="text-[10px] text-stone-500">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5">
        {[35, 55, 42, 70, 58, 88, 64, 95, 72, 100, 60, 45].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-orange-700 to-orange-400" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ProductTabs() {
  const [tab, setTab] = useState<Tab>("Customer");
  return (
    <div>
      <div className="no-scrollbar flex justify-start gap-2 overflow-x-auto md:justify-center" role="tablist" aria-label="Product views">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-full px-5 py-2.5 text-[13px] font-black transition active:scale-95 ${
              tab === t ? "bg-orange-600 text-white shadow-xl" : "bg-white/5 text-stone-300 hover:bg-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade-in mt-6">
        <Panel tab={tab} />
      </div>
    </div>
  );
}
