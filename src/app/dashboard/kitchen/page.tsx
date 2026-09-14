"use client";
import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

type Order = { id: string; tokenNo: number; tableCode: string; status: string; createdAt: string; note: string; items: { name: string; qty: number; note: string }[] };

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  async function load() {
    const r = await fetch("/api/orders?status=ALL");
    const j = await r.json();
    if (j.orders) setOrders(j.orders.filter((o: Order) => ["ACCEPTED", "PREPARING", "NEW"].includes(o.status)));
  }
  useEffect(() => { load(); const t = setInterval(load, 3500); document.title = "KDS — Kitchen"; return () => clearInterval(t); }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-black">👨‍🍳 Kitchen display</h1>
      <p className="text-sm text-stone-400">Big cards, timers, one-tap advance. Open this on the kitchen tab.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((o) => {
          const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
          const rush = mins >= 10;
          return (
            <div key={o.id} className={`rounded-3xl border p-6 ${rush ? "border-red-500/60 bg-red-500/5" : "border-white/10 bg-white/[.03]"}`}>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-black">#{o.tokenNo} • {o.tableCode}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${rush ? "bg-red-500 text-white" : "bg-white/10"}`}>{mins}m {timeAgo(o.createdAt)}</span>
              </div>
              <div className="mt-3 space-y-2">
                {o.items.map((i, k) => (
                  <p key={k} className="rounded-2xl bg-black/30 p-3 text-lg font-bold">{i.qty}× {i.name}{i.note ? <span className="block text-sm text-amber-300">({i.note})</span> : null}</p>
                ))}
              </div>
              {o.note && <p className="mt-2 text-sm text-amber-300">📝 {o.note}</p>}
              <div className="mt-4 flex gap-2">
                {o.status === "NEW" && <button onClick={() => setStatus(o.id, "ACCEPTED")} className="flex-1 rounded-2xl bg-sky-600 py-3 font-black">ACCEPT</button>}
                {(o.status === "NEW" || o.status === "ACCEPTED") && <button onClick={() => setStatus(o.id, "PREPARING")} className="flex-1 rounded-2xl bg-violet-600 py-3 font-black">COOKING</button>}
                {o.status === "PREPARING" && <button onClick={() => setStatus(o.id, "READY")} className="flex-1 rounded-2xl bg-emerald-600 py-3 font-black">READY 🎉</button>}
              </div>
            </div>
          );
        })}
      </div>
      {orders.length === 0 && <p className="py-16 text-center text-stone-500">Kitchen is clear. ✨ New KOTs appear here instantly.</p>}
    </div>
  );
}
