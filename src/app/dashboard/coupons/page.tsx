"use client";
import { useEffect, useState } from "react";
import { EmptyState, SectionTitle, useToast } from "@/components/ux";

type Coupon = { id: string; code: string; pct: number; active: boolean };

export default function CouponsPage() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("10");

  async function load() {
    const r = await fetch("/api/coupons");
    const j = await r.json();
    if (!j.error) setCoupons(j.coupons);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const r = await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, pct: Number(pct) }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || "Failed", "err");
    toast(`${j.coupon.code} — ${j.coupon.pct}% off is live 🎉`);
    setCode(""); setPct("10"); load();
  }

  async function toggle(c: Coupon) {
    await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c.code, pct: c.pct, active: !c.active }) });
    load();
  }

  return (
    <div>
      <SectionTitle title="Discounts & offers 🏷️" sub="Coupons appear on the customer menu — tap-to-apply at checkout." />
      <div className="glass mt-4 rounded-3xl p-5">
        <p className="text-sm font-black">Create offer</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="CODE (e.g. DIWALI25)" className="flex-1 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-2.5 text-sm font-bold tracking-wider outline-none focus:border-amber-400" />
          <div className="flex items-center gap-2">
            <input value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="%" className="w-20 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold outline-none" />
            <span className="text-sm text-stone-400">% off</span>
          </div>
          <button onClick={save} className="rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2.5 text-sm font-black">Launch offer 🚀</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["WELCOME10:10", "HAPPYHOUR20:20", "WEEKEND15:15", "FLAT50:50"].map((s) => {
            const [c, p] = s.split(":");
            return <button key={c} onClick={() => { setCode(c); setPct(p); }} className="rounded-full bg-white/5 px-3 py-1 text-xs text-stone-300 hover:bg-white/10">{c} · {p}%</button>;
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {coupons.map((c) => (
          <div key={c.id} className={`relative overflow-hidden rounded-3xl border p-5 ${c.active ? "border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-orange-600/10" : "border-white/10 bg-white/[.03] opacity-60"}`}>
            <div className="absolute -right-4 -top-4 rounded-full bg-white/5 px-6 py-5 text-4xl">🎟️</div>
            <p className="text-xl font-black tracking-widest">{c.code}</p>
            <p className="text-sm text-stone-300">{c.pct}% off entire bill {c.active ? "• LIVE on menu" : "• paused"}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => toggle(c)} className="rounded-xl bg-white/10 px-4 py-1.5 text-xs font-bold">{c.active ? "Pause" : "Activate"}</button>
              <button onClick={async () => { if (!confirm(`Delete ${c.code}?`)) return; await fetch(`/api/coupons?id=${c.id}`, { method: "DELETE" }); toast("Offer deleted", "info"); load(); }} className="rounded-xl border border-red-500/30 px-4 py-1.5 text-xs text-red-300">Delete</button>
            </div>
          </div>
        ))}
      </div>
      {coupons.length === 0 && <div className="mt-4"><EmptyState emoji="🎟️" title="No offers yet" hint="Launch WELCOME10 to turn first-time scanners into regulars." /></div>}
    </div>
  );
}
