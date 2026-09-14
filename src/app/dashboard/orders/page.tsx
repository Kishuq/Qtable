"use client";
import { useCallback, useEffect, useState } from "react";
import { inr, timeAgo } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { useToast } from "@/components/ux";

type Order = {
  id: string; tokenNo: number; tableCode: string; customerName: string; customerPhone: string;
  status: string; paymentMode: string; paymentStatus: string; total: number; subtotal: number; discount: number; tax: number;
  note: string; createdAt: string; items: { name: string; qty: number; price: number; note: string }[];
  payments: { mode: string; status: string; providerRef: string }[];
};

const FILTERS = ["ALL", "NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"];

export default function OrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders?status=${filter}&q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (j.orders) setOrders(j.orders);
  }, [filter, q]);

  useEffect(() => { load(); const t = setInterval(load, 3500); return () => clearInterval(t); }, [load]);

  async function setStatus(id: string, status: string, paymentStatus?: string) {
    try {
      const r = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...(paymentStatus ? { paymentStatus } : {}) }) });
      const j = await r.json().catch(() => ({}));
      // Another screen may have moved this order first — say so instead of failing silently.
      if (!r.ok) toast(j.error || "Someone already moved this order — refreshing", "err");
    } catch {
      toast("Network hiccup — check connection", "err");
    }
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black">Live orders 🔔</h1>
        <p className="text-xs text-stone-400">Alarm rings automatically on new orders — toggle in the sidebar.</p>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search table / name / phone" className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold ${filter === f ? "bg-orange-600" : "bg-white/5"}`}>{f}</button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {orders.map((o) => (
          <div key={o.id} className={`glass rounded-3xl p-5 ${o.status === "NEW" ? "border-amber-500/40" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black">#{o.tokenNo} • Table {o.tableCode} {o.status === "NEW" && <span className="ml-1 animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[10px]">NEW</span>}</p>
                <p className="text-xs text-stone-400">{o.customerName}{o.customerPhone ? ` • ${o.customerPhone}` : ""} • {timeAgo(o.createdAt)}</p>
              </div>
              <StatusPill status={o.status} />
            </div>
            <div className="mt-3 space-y-1 rounded-2xl bg-white/[.04] p-3 text-sm">
              {o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.qty}× {i.name}{i.note ? <span className="text-stone-500"> ({i.note})</span> : ""}</span><span className="font-bold">{inr(i.price * i.qty)}</span></div>)}
              <div className="flex justify-between border-t border-white/10 pt-2 text-xs text-stone-400"><span>Sub {inr(o.subtotal)} • Disc {inr(o.discount)} • GST {inr(o.tax)}</span><b className="text-white">{inr(o.total)}</b></div>
              {o.note && <p className="text-xs text-amber-300">📝 {o.note}</p>}
              <p className="text-xs text-stone-400">💳 {o.paymentMode} • <StatusPill status={o.paymentStatus} /></p>
              {o.paymentMode === "UPI" && o.paymentStatus !== "PAID" && (
                <p className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-200">
                  ⚠️ UPI not yet confirmed — tap <b>✓ Received</b> the moment {inr(o.total)} lands in your UPI app.
                  {o.payments?.find((p) => p.providerRef)?.providerRef ? <span className="block text-amber-200/70">Customer ref (if given): {o.payments.find((p) => p.providerRef)?.providerRef}</span> : null}
                </p>
              )}
              {o.paymentMode === "ONLINE" && o.paymentStatus !== "PAID" && (
                <p className="rounded-xl bg-sky-500/10 p-2 text-xs text-sky-200">🔒 Online payment {o.payments?.[0]?.providerRef ? `(ref ${o.payments[0].providerRef})` : ""} — auto-confirms via gateway. Mark paid only if you verified it in the gateway dashboard.</p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {o.status === "NEW" && <><button onClick={() => setStatus(o.id, "ACCEPTED")} className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-black">Accept</button><button onClick={() => setStatus(o.id, "CANCELLED")} className="rounded-xl border border-red-500/40 px-4 py-2 text-xs font-bold text-red-300">Cancel</button></>}
              {o.status === "ACCEPTED" && <button onClick={() => setStatus(o.id, "PREPARING")} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black">→ Preparing</button>}
              {o.status === "PREPARING" && <button onClick={() => setStatus(o.id, "READY")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black">→ Ready 🎉</button>}
              {o.status === "READY" && <button onClick={() => setStatus(o.id, "SERVED")} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-black">→ Served</button>}
              {o.status === "SERVED" && <button onClick={() => setStatus(o.id, "COMPLETED")} className="rounded-xl bg-stone-600 px-4 py-2 text-xs font-black">→ Complete</button>}
              {o.paymentStatus !== "PAID" && o.status !== "CANCELLED" && (
                <button onClick={() => {
                  if (o.paymentMode === "UPI") {
                    if (!confirm(`${inr(o.total)} received in your UPI app for order #${o.tokenNo} (${o.tableCode})?`)) return;
                  } else if (!confirm(`Confirm ${inr(o.total)} received (${o.paymentMode}) for order #${o.tokenNo}?`)) return;
                  setStatus(o.id, o.status, "PAID");
                }} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white">✓ Received</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {orders.length === 0 && <p className="py-16 text-center text-stone-500">No orders in this view. New scans will pop here with sound. 🔊</p>}
    </div>
  );
}
