"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { inr, timeAgo } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

type Order = { id: string; tokenNo: number; tableCode: string; customerName: string; status: string; total: number; createdAt: string; items: { name: string; qty: number }[] };

export default function Overview() {
  const [stats, setStats] = useState<{ today: { orders: number; revenue: number; open: number }; topItems: { name: string; _sum: { qty: number | null } }[]; avgRating: number; feedbacks: { id: string; rating: number; comment: string; createdAt: string }[] } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [upiMissing, setUpiMissing] = useState(false);
  async function load() {
    const [a, o, c] = await Promise.all([
      fetch("/api/analytics").then((r) => r.json()).catch(() => null),
      fetch("/api/orders").then((r) => r.json()).catch(() => null),
      fetch("/api/cafe").then((r) => r.json()).catch(() => null),
    ]);
    if (a && !a.error) setStats(a);
    if (o?.orders) setOrders(o.orders.slice(0, 8));
    if (c?.cafe) setUpiMissing(!c.cafe.upiId && (c.cafe.currency || "INR") === "INR");
  }
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  return (
    <div>
      {upiMissing && (
        <Link href="/dashboard/settings" className="mb-4 block rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-bold text-amber-200">
          ⚠️ No UPI ID set — customers can only pay at the counter. Tap here to add it in Settings (30 seconds).
        </Link>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Good to see you 👋</h1>
        <Link href="/dashboard/orders" className="rounded-full bg-orange-600 px-5 py-2 text-sm font-bold">Live orders →</Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Today's revenue", stats ? inr(stats.today.revenue) : "…", "💰"],
          ["Orders today", stats ? String(stats.today.orders) : "…", "🧾"],
          ["Open right now", stats ? String(stats.today.open) : "…", "🔔"],
          ["Avg rating", stats ? `${stats.avgRating} ⭐` : "…", "❤️"],
        ].map(([l, v, e]) => (
          <div key={l} className="glass card-hover rounded-3xl p-5"><p className="text-2xl">{e}</p><p className="mt-1 text-xl font-black">{v}</p><p className="text-xs text-stone-400">{l}</p></div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between"><p className="font-black">Latest orders</p><Link href="/dashboard/orders" className="text-xs font-bold text-orange-400">View all</Link></div>
          <div className="mt-3 space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-2xl bg-white/[.04] p-3 text-sm">
                <div><p className="font-bold">#{o.tokenNo} • {o.tableCode} <span className="text-stone-400">• {o.customerName}</span></p><p className="text-xs text-stone-500">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} • {timeAgo(o.createdAt)}</p></div>
                <div className="text-right"><StatusPill status={o.status} /><p className="mt-1 text-xs font-bold">{inr(o.total)}</p></div>
              </div>
            ))}
            {orders.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No orders yet. Share your table QRs! 📣</p>}
          </div>
        </div>
        <div className="glass rounded-3xl p-5">
          <p className="font-black">Top sellers</p>
          <div className="mt-3 space-y-2">
            {(stats?.topItems || []).map((t) => (
              <div key={t.name} className="flex justify-between rounded-2xl bg-white/[.04] p-3 text-sm"><span>{t.name}</span><b>{t._sum.qty} sold</b></div>
            ))}
            {(stats?.topItems || []).length === 0 && <p className="py-6 text-center text-sm text-stone-500">Sales will appear here.</p>}
          </div>
          <div className="mt-4 rounded-2xl bg-orange-600/10 p-4 text-sm">
            <p className="font-bold">⚡ Quick setup checklist</p>
            <p className="mt-1 text-stone-300">1. Menu → add items 2. Tables → print QRs 3. Settings → add UPI ID 4. Keep Orders open on counter.</p>
          </div>
        </div>
      </div>

      {(stats?.feedbacks?.length || 0) > 0 && (
        <div className="glass mt-4 rounded-3xl p-5">
          <p className="font-black">💬 What customers say</p>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {stats!.feedbacks.map((f) => (
              <div key={f.id} className="w-64 shrink-0 rounded-2xl bg-white/[.04] p-4 text-sm">
                <p>{"⭐".repeat(Math.min(5, f.rating))}</p>
                <p className="mt-1 text-stone-300">{f.comment || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
