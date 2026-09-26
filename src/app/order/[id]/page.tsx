"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { inr } from "@/lib/format";
import { ThemeStyles } from "@/components/theme";
import { themeFromCafe, type Theme } from "@/lib/theme";
import { CardSkeleton } from "@/components/ux";

const STEPS = ["NEW", "ACCEPTED", "PREPARING", "READY", "SERVED", "COMPLETED"];

type Order = {
  id: string; tokenNo: number; status: string; total: number; subtotal: number; discount: number; tax: number;
  tableCode: string; paymentMode: string; paymentStatus: string; customerName: string; cafeName: string; upiId: string; currency: string;
  queueAhead: number; etaMinutes: number;
  theme: { primary: string; accent: string; bg: string; bgMode: string; pattern: string; font: string; radius: string };
  items: { name: string; qty: number; price: number }[];
};

const TIMELINE = [
  { key: "RECEIVED", label: "Received", emoji: "🧾", match: ["NEW", "ACCEPTED"] },
  { key: "PREPARING", label: "Preparing", emoji: "👨‍🍳", match: ["PREPARING"] },
  { key: "READY", label: "Ready", emoji: "🔔", match: ["READY"] },
  { key: "SERVED", label: "Served", emoji: "😋", match: ["SERVED", "COMPLETED"] },
];

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [o, setO] = useState<Order | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [fbDone, setFbDone] = useState(false);
  const [returned, setReturned] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("paid") === "1") setReturned(true);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/public/order/${id}`);
        const j = await r.json();
        if (alive && r.ok) setO(j.order);
        else if (alive && !r.ok) setLoadErr(j.error || "Order not found.");
      } catch { /* retry */ }
    }
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [id]);

  if (!o) return (
    <div className="mx-auto w-full max-w-md flex-1 px-5 py-20 text-center">
      {loadErr ? (
        <><p className="text-4xl">😕</p><p className="mt-3 font-bold">{loadErr}</p>
        <p className="mt-1 text-sm text-stone-400">Check the link or ask the counter for your token number.</p>
        <Link href="/" className="mt-4 inline-block font-bold text-orange-400">← Back to menu</Link></>
      ) : <><CardSkeleton /><p className="mt-3 text-sm text-stone-400">Finding your order…</p></>}
    </div>
  );
  const theme: Theme = themeFromCafe(o.theme);

  return (
    <ThemeStyles theme={theme}>
    <div className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <div className="glass t-card animate-slide-up p-6 text-center">
        <p className="t-muted text-xs font-bold">TOKEN #{o.tokenNo} • {o.cafeName} • TABLE {o.tableCode}</p>
        <p className="t-heading mt-2 text-3xl font-black">
          {o.status === "READY" ? "🎉 Ready!" : o.status === "COMPLETED" ? "✅ Enjoy!" : o.status === "CANCELLED" ? "❌ Cancelled" : o.status === "SERVED" ? "😋 Served!" : `⏳ ${o.status}`}
        </p>
        <p className="t-muted mt-1 text-sm">Hi {o.customerName} — this updates live. Keep the tab open.</p>
        {o.status !== "CANCELLED" && o.etaMinutes > 0 && (
          <p className="t-grad mx-auto mt-3 w-fit rounded-full px-4 py-1.5 text-xs font-black text-white shadow-lg">
            ⏱️ Ready in ~{o.etaMinutes} min{o.queueAhead > 0 ? ` • ${o.queueAhead} order${o.queueAhead === 1 ? "" : "s"} ahead` : ""}
          </p>
        )}
        {o.status !== "CANCELLED" && o.etaMinutes === 0 && o.status !== "NEW" && o.status !== "ACCEPTED" && o.status !== "PREPARING" && (
          <p className="mx-auto mt-3 w-fit rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-black text-emerald-300">
            With you now — enjoy! 🎉
          </p>
        )}
        {/* Visual journey timeline */}
        <div className="mt-5">
          <div className="flex items-start justify-between">
            {TIMELINE.map((t, i) => {
              const activeIdx = o.status === "CANCELLED" ? -1 : TIMELINE.findIndex((x) => x.match.includes(o.status));
              const done = activeIdx >= 0 && i < activeIdx;
              const current = activeIdx === i;
              return (
                <div key={t.key} className="flex flex-1 flex-col items-center">
                  <span className={`grid size-11 place-items-center rounded-2xl text-xl transition ${
                    o.status === "CANCELLED" ? "bg-red-500/15 opacity-60"
                    : done ? "bg-emerald-500/20"
                    : current ? "t-grad text-white shadow-xl animate-pulse-ring" : "bg-white/5 opacity-60"
                  }`}>
                    {done ? "✓" : t.emoji}
                  </span>
                  <span className={`mt-1.5 text-[10px] font-black ${current ? "text-white" : "t-muted"}`}>{t.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-center gap-1 sm:hidden">
            {STEPS.map((s, i) => <div key={s} className={`h-2 w-10 rounded-full ${o.status === "CANCELLED" ? "bg-red-500/40" : i <= STEPS.indexOf(o.status) ? "t-grad" : "bg-white/10"}`} />)}
          </div>
        </div>
        <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          {o.items.map((i, k) => <div key={k} className="flex justify-between"><span>{i.name} × {i.qty}</span><span className="font-bold">{inr(i.price * i.qty, o.currency)}</span></div>)}
          {o.discount > 0 && <div className="flex justify-between text-xs text-emerald-300"><span>Discount</span><span>−{inr(o.discount, o.currency)}</span></div>}
          <div className="flex justify-between pt-2 font-black"><span>Total</span><span>{inr(o.total, o.currency)}</span></div>
        </div>
        <p className="t-muted mt-2 text-xs">Payment: {o.paymentMode} • {o.paymentStatus}</p>
        {o.paymentMode === "ONLINE" && o.paymentStatus !== "PAID" && (
          <p className="mt-2 rounded-2xl bg-sky-500/10 p-3 text-xs text-sky-200">
            {returned ? "🏦 Returned from bank — confirming payment… this flips automatically in a few seconds. Don't pay again." : "⏳ Online payment pending — it confirms automatically via the gateway. Show this screen at the counter if needed."}
          </p>
        )}
        {o.paymentMode === "UPI" && o.paymentStatus !== "PAID" && o.upiId && (
          <div className="mt-3 rounded-2xl bg-white/5 p-4">
            <p className="text-xs">Pay {inr(o.total, o.currency)} to <b>{o.upiId}</b></p>
            <img src={`/api/qr?text=${encodeURIComponent(`upi://pay?pa=${o.upiId}&pn=${o.cafeName}&am=${(o.total / 100).toFixed(2)}&cu=INR`)}`} alt="UPI QR" className="mx-auto mt-2 size-40 rounded-2xl bg-white p-2" />
          </div>
        )}
      </div>
      <div className="glass t-card mt-4 p-6 text-center">
        {fbDone ? <p className="font-bold text-emerald-300">Thanks for the feedback! ⭐</p> : (
          <>
            <p className="font-bold">Rate your experience</p>
            <div className="mt-2 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => <button key={s} onClick={() => setRating(s)} className={`text-2xl transition ${s <= rating ? "" : "opacity-30"}`}>⭐</button>)}
            </div>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Say something nice…" className="t-card mt-3 w-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none" />
            <button onClick={async () => { await fetch("/api/public/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id, rating, comment }) }); setFbDone(true); }} className="t-grad mt-3 w-full rounded-2xl py-2.5 text-sm font-black text-white">Send</button>
          </>
        )}
      </div>
      <Link href="/" className="t-muted mt-4 block text-center text-sm">← Back to menu</Link>
    </div>
    </ThemeStyles>
  );
}
