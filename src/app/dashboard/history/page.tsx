"use client";
import { useCallback, useEffect, useState } from "react";
import { inr, timeAgo, fdate } from "@/lib/format";
import { EmptyState, SectionTitle } from "@/components/ux";
import { StatusPill } from "@/components/StatusPill";

type Order = {
  id: string; tokenNo: number; tableCode: string; customerName: string; customerPhone: string;
  status: string; paymentMode: string; paymentStatus: string; total: number; type: string;
  createdAt: string; items: { name: string; qty: number; price: number }[];
};

function day(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [from, setFrom] = useState(day(7));
  const [to, setTo] = useState(day(0));
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders?history=1&from=${from}&to=${to}&status=${status}&q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (!j.error) { setOrders(j.orders); setRevenue(j.revenue || 0); }
  }, [from, to, status, q]);

  useEffect(() => { load(); }, [load]);

  function csv() {
    const rows = [["Token", "Date", "Table", "Customer", "Phone", "Type", "Status", "Payment", "Items", "Total INR"]];
    for (const o of orders) {
      rows.push([String(o.tokenNo), fdate(o.createdAt), o.tableCode, o.customerName, o.customerPhone, o.type, o.status, `${o.paymentMode}/${o.paymentStatus}`,
        o.items.map((i) => `${i.qty}x ${i.name}`).join("; "), (o.total / 100).toFixed(2)]);
    }
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${from}-to-${to}.csv`;
    a.click();
  }

  const done = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div>
      <SectionTitle title="Order history 📚" sub="Every order ever — filter, audit, export for your accountant."
        right={<button onClick={csv} disabled={orders.length === 0} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold hover:bg-white/15 disabled:opacity-40">⬇ Export CSV</button>} />

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[["🧾 Orders", String(orders.length)], ["💰 Revenue", inr(revenue)], ["✅ Completed", String(done)]].map(([l, v]) => (
          <div key={l} className="glass rounded-3xl p-4"><p className="text-lg font-black">{v}</p><p className="text-xs text-stone-400">{l}</p></div>
        ))}
      </div>

      <div className="glass mt-4 flex flex-col gap-2 rounded-3xl p-4 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-xs text-stone-400">From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /></label>
        <label className="flex items-center gap-2 text-xs text-stone-400">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-white/10 bg-stone-900 px-3 py-2 text-sm">
          {["ALL", "COMPLETED", "CANCELLED", "SERVED", "READY", "NEW"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search table / name / phone" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none" />
      </div>

      <div className="mt-3 space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="glass rounded-2xl">
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex w-full items-center gap-3 p-3.5 text-left text-sm">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 font-black">#{o.tokenNo}</span>
              <span className="min-w-0 flex-1"><b>{o.tableCode}</b> • {o.customerName} <span className="block truncate text-xs text-stone-500">{fdate(o.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} • {o.items.reduce((a, i) => a + i.qty, 0)} items • {o.paymentMode}</span></span>
              <StatusPill status={o.status} />
              <b className="whitespace-nowrap">{inr(o.total)}</b>
            </button>
            {expanded === o.id && (
              <div className="animate-slide-up space-y-1 border-t border-white/10 p-4 text-sm">
                {o.items.map((i, k) => <div key={k} className="flex justify-between text-stone-300"><span>{i.qty}× {i.name}</span><span>{inr(i.price * i.qty)}</span></div>)}
                <div className="flex justify-between pt-1 text-xs text-stone-500"><span>{o.type} • {o.customerPhone || "no phone"} • {timeAgo(o.createdAt)}</span><StatusPill status={o.paymentStatus} /></div>
              </div>
            )}
          </div>
        ))}
      </div>
      {orders.length === 0 && <div className="mt-4"><EmptyState emoji="📚" title="No orders in this range" hint="Widen the dates or clear the search." /></div>}
    </div>
  );
}
