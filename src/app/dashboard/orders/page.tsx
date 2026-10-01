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

type WaiterCall = { id: string; tableCode: string; status: string; createdAt: string };

export default function OrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [q, setQ] = useState("");
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  // Which card+action is in flight — drives spinners + disabled states so every
  // tap gives instant visible feedback (optimistic UI, rollback on failure).
  const [pending, setPending] = useState<{ id: string; action: string } | null>(null);
  const [busyCall, setBusyCall] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders?status=${filter}&q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (j.orders) setOrders(j.orders);
  }, [filter, q]);

  const loadCalls = useCallback(async () => {
    try {
      const r = await fetch("/api/waiter");
      const j = await r.json();
      if (j.calls) setCalls(j.calls);
    } catch { /* offline — next poll retries */ }
  }, []);

  // Skip ticks while the tab is hidden — counter tablets sit open for hours;
  // no point burning DB + battery rendering nothing.
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 3500); return () => clearInterval(t); }, [load]);
  useEffect(() => { loadCalls(); const t = setInterval(() => { if (!document.hidden) loadCalls(); }, 4000); return () => clearInterval(t); }, [loadCalls]);

  async function setCallStatus(id: string, status: string) {
    const prev = calls;
    setBusyCall(id);
    // Optimistic flip so the tap feels instant.
    setCalls((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    try {
      const r = await fetch("/api/waiter", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!r.ok) throw new Error("Could not update request");
      toast(status === "RESOLVED" ? "Request cleared ✓" : "On the way ✓", "ok");
    } catch (e: unknown) {
      setCalls(prev);
      toast(e instanceof Error ? e.message : "Network hiccup — check connection", "err");
    } finally {
      setBusyCall(null);
      loadCalls();
    }
  }

  async function setStatus(id: string, status: string, paymentStatus?: string) {
    const prev = orders;
    const target = prev.find((o) => o.id === id);
    const action = paymentStatus === "PAID" ? "paid" : status;
    setPending({ id, action });
    // Optimistic flip — the card moves instantly, server confirms after.
    setOrders((os) =>
      os.map((o) => (o.id === id ? { ...o, status: paymentStatus ? o.status : status, paymentStatus: paymentStatus || o.paymentStatus } : o))
    );
    try {
      const r = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...(paymentStatus ? { paymentStatus } : {}) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Someone already moved this order — refreshing");
      toast(
        paymentStatus === "PAID"
          ? `#${target?.tokenNo ?? ""} marked paid ✓`
          : `#${target?.tokenNo ?? ""} → ${status.charAt(0) + status.slice(1).toLowerCase()} ✓`,
        "ok"
      );
    } catch (e: unknown) {
      setOrders(prev); // rollback to server truth
      toast(e instanceof Error ? e.message : "Network hiccup — check connection", "err");
    } finally {
      setPending(null);
      load();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          Live orders 🔔
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> AUTO
          </span>
        </h1>
        <p className="text-xs text-stone-400">Alarm rings automatically on new orders — toggle in the sidebar.</p>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search table / name / phone" className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition active:scale-95 ${filter === f ? "bg-orange-600 shadow-lg" : "bg-white/5 hover:bg-white/10"}`}>{f}</button>
        ))}
      </div>

      {calls.length > 0 && (
        <div className="animate-slide-up mt-4 space-y-2 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-black text-amber-200">🛎️ {calls.length} table{calls.length === 1 ? "" : "s"} need{calls.length === 1 ? "s" : ""} assistance</p>
          {calls.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-2xl bg-black/25 p-3 text-sm">
              <div>
                <p className="font-black text-white">
                  Table {c.tableCode}
                  {c.status === "OPEN"
                    ? <span className="ml-2 animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-black">NEW</span>
                    : <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-stone-300">SEEN</span>}
                </p>
                <p className="text-xs text-stone-400">{timeAgo(c.createdAt)}</p>
              </div>
              <div className="flex gap-1.5">
                {c.status === "OPEN" && (
                  <button onClick={() => setCallStatus(c.id, "ACKNOWLEDGED")} disabled={busyCall === c.id}
                    className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-black text-black transition hover:brightness-110 active:scale-95 disabled:opacity-60">
                    {busyCall === c.id ? "… ⏳" : "On my way ✓"}
                  </button>
                )}
                <button onClick={() => setCallStatus(c.id, "RESOLVED")} disabled={busyCall === c.id}
                  className="rounded-xl bg-white/10 px-3.5 py-1.5 text-xs font-bold text-stone-200 transition hover:bg-white/20 active:scale-95 disabled:opacity-60">
                  {busyCall === c.id ? "… ⏳" : "Done"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {orders.map((o, idx) => (
          <div key={o.id} className={`glass animate-slide-up rounded-3xl p-5 ${o.status === "NEW" ? "border-amber-500/40" : ""}`} style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-xl font-bold tracking-tight tnum">#{o.tokenNo} <span className="text-sm font-bold text-stone-400">• Table {o.tableCode}</span> {o.status === "NEW" && <span className="ml-1 animate-pulse rounded-full bg-amber-500 px-2 py-0.5 align-middle text-[10px]">NEW</span>}</p>
                <p className="text-xs text-stone-400">{o.customerName}{o.customerPhone ? ` • ${o.customerPhone}` : ""} • {timeAgo(o.createdAt)}</p>
              </div>
              <StatusPill status={o.status} />
            </div>
            <div className="mt-3 space-y-1 rounded-2xl bg-white/[.04] p-3 text-sm">
              {o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.qty}× {i.name}{i.note ? <span className="text-stone-500"> ({i.note})</span> : ""}</span><span className="tnum font-bold">{inr(i.price * i.qty)}</span></div>)}
              <div className="ticket-perf mx-1 mt-2" />
              <div className="flex justify-between pt-2 text-xs text-stone-400"><span>Sub {inr(o.subtotal)} • Disc {inr(o.discount)} • GST {inr(o.tax)}</span><b className="tnum text-white">{inr(o.total)}</b></div>
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
              {o.status === "NEW" && <>
                <button onClick={() => setStatus(o.id, "ACCEPTED")} disabled={pending?.id === o.id}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-black transition hover:brightness-110 active:scale-95 disabled:opacity-60">
                  {pending?.id === o.id && pending.action === "ACCEPTED" ? "Accepting… ⏳" : "Accept"}
                </button>
                <button onClick={() => setStatus(o.id, "CANCELLED")} disabled={pending?.id === o.id}
                  className="rounded-xl border border-red-500/40 px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 active:scale-95 disabled:opacity-60">
                  {pending?.id === o.id && pending.action === "CANCELLED" ? "Cancelling… ⏳" : "Cancel"}
                </button>
              </>}
              {o.status === "ACCEPTED" && (
                <button onClick={() => setStatus(o.id, "PREPARING")} disabled={pending?.id === o.id}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black transition hover:brightness-110 active:scale-95 disabled:opacity-60">
                  {pending?.id === o.id ? "Moving… ⏳" : "→ Preparing"}
                </button>
              )}
              {o.status === "PREPARING" && (
                <button onClick={() => setStatus(o.id, "READY")} disabled={pending?.id === o.id}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black transition hover:brightness-110 active:scale-95 disabled:opacity-60">
                  {pending?.id === o.id ? "Firing… ⏳" : "→ Ready 🎉"}
                </button>
              )}
              {o.status === "READY" && (
                <button onClick={() => setStatus(o.id, "SERVED")} disabled={pending?.id === o.id}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-black transition hover:brightness-110 active:scale-95 disabled:opacity-60">
                  {pending?.id === o.id ? "Moving… ⏳" : "→ Served"}
                </button>
              )}
              {o.status === "SERVED" && (
                <button onClick={() => setStatus(o.id, "COMPLETED")} disabled={pending?.id === o.id}
                  className="rounded-xl bg-stone-600 px-4 py-2 text-xs font-black transition hover:brightness-110 active:scale-95 disabled:opacity-60">
                  {pending?.id === o.id ? "Closing… ⏳" : "→ Complete"}
                </button>
              )}
              {o.paymentStatus !== "PAID" && o.status !== "CANCELLED" && (
                <button onClick={() => {
                  if (pending?.id === o.id) return;
                  if (o.paymentMode === "UPI") {
                    if (!confirm(`${inr(o.total)} received in your UPI app for order #${o.tokenNo} (${o.tableCode})?`)) return;
                  } else if (!confirm(`Confirm ${inr(o.total)} received (${o.paymentMode}) for order #${o.tokenNo}?`)) return;
                  setStatus(o.id, o.status, "PAID");
                }} disabled={pending?.id === o.id}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:brightness-110 active:scale-95 disabled:opacity-60">
                  {pending?.id === o.id && pending.action === "paid" ? "Confirming… ⏳" : "✓ Received"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {orders.length === 0 && <p className="py-16 text-center text-stone-500">No orders in this view. New scans will pop here with sound. 🔊</p>}
    </div>
  );
}
