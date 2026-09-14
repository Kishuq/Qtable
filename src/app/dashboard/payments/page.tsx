"use client";
import { useEffect, useState } from "react";
import { inr, timeAgo } from "@/lib/format";
import { EmptyState, SectionTitle } from "@/components/ux";
import { StatusPill } from "@/components/StatusPill";

type Pay = { id: string; mode: string; status: string; amount: number; providerRef: string; createdAt: string; order: { tokenNo: number; tableCode: string; customerName: string; status: string } };

export default function PaymentsPage() {
  const [data, setData] = useState<{ payments: Pay[]; collected: number; pending: number } | null>(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/payments").then((r) => r.json()).then((j) => { if (!j.error) setData(j); }).catch(() => {});
  }, []);

  const list = (data?.payments || []).filter((p) => filter === "ALL" || p.status === filter || p.mode === filter);

  return (
    <div>
      <SectionTitle title="Payments ledger 💰" sub="Every rupee, traced to its order. Verify UPI claims here, then mark orders paid." />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="glass rounded-3xl border-emerald-500/20 p-5"><p className="text-2xl">✅</p><p className="mt-1 text-xl font-black text-emerald-300">{data ? inr(data.collected) : "…"}</p><p className="text-xs text-stone-400">Collected</p></div>
        <div className="glass rounded-3xl border-amber-500/20 p-5"><p className="text-2xl">⏳</p><p className="mt-1 text-xl font-black text-amber-300">{data ? inr(data.pending) : "…"}</p><p className="text-xs text-stone-400">Awaiting verification</p></div>
      </div>
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {["ALL", "PAID", "PENDING", "COUNTER", "UPI", "ONLINE"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold ${filter === f ? "bg-orange-600" : "bg-white/5"}`}>{f}</button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {list.map((p) => (
          <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3.5 text-sm">
            <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-xl">{p.mode === "UPI" ? "📱" : p.mode === "ONLINE" ? "💳" : "💵"}</span>
            <div className="flex-1"><p className="font-bold">#{p.order.tokenNo} • {p.order.tableCode} • {p.order.customerName}</p>
              <p className="text-xs text-stone-500">{p.mode}{p.providerRef ? ` • ref ${p.providerRef}` : ""} • {timeAgo(p.createdAt)}</p></div>
            <div className="text-right"><p className="font-black">{inr(p.amount)}</p><StatusPill status={p.status} /></div>
          </div>
        ))}
      </div>
      {list.length === 0 && <div className="mt-4"><EmptyState emoji="💰" title="No payments in this view" hint="New orders create ledger entries automatically." /></div>}
    </div>
  );
}
