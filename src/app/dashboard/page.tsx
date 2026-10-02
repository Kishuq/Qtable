"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { inr, timeAgo } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { PLANS, type PlanId } from "@/lib/plans";

type Order = { id: string; tokenNo: number; tableCode: string; customerName: string; status: string; total: number; createdAt: string; items: { name: string; qty: number }[] };

export default function Overview() {
  const [stats, setStats] = useState<{ today: { orders: number; revenue: number; open: number }; topItems: { name: string; _sum: { qty: number | null } }[]; avgRating: number; feedbacks: { id: string; rating: number; comment: string; createdAt: string }[]; lowStock?: { name: string; stock: number }[] } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [upiMissing, setUpiMissing] = useState(false);
  // Plain-words system status: silent when healthy, loud + actionable when not.
  // Owners should never have to interpret logs or status codes.
  const [sysHealth, setSysHealth] = useState<"ok" | "bad" | null>(null);
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => setSysHealth(r.ok ? "ok" : "bad"))
      .catch(() => setSysHealth("bad"));
  }, []);
  // First-run onboarding checklist — auto-checks as the owner completes setup.
  const [guide, setGuide] = useState<{ menu: boolean; tables: boolean; team: boolean } | null>(null);
  const [guideOff, setGuideOff] = useState(() => {
    try { return localStorage.getItem("qtable_guide_done") === "1"; } catch { return false; }
  });
  useEffect(() => {
    (async () => {
      try {
        const [m, t, s] = await Promise.all([
          fetch("/api/menu").then((r) => r.json()).catch(() => null),
          fetch("/api/tables").then((r) => r.json()).catch(() => null),
          fetch("/api/staff").then((r) => r.json()).catch(() => null),
        ]);
        setGuide({
          menu: Array.isArray(m?.items) && m.items.length > 0,
          tables: Array.isArray(t?.tables) && t.tables.length > 0,
          team: Array.isArray(s?.staff) && s.staff.length > 1,
        });
      } catch { /* offline — checklist waits */ }
    })();
  }, []);
  // hPanel-style empty state: logged in, but no active subscription → plan picker.
  const [blocked, setBlocked] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/billing/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const b = j?.billing;
        setBlocked(Boolean(b && b.mode === "enforced" && ["past_due", "unpaid", "canceled"].includes(b.status)));
      })
      .catch(() => setBlocked(false));
  }, []);
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
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 5000); return () => clearInterval(t); }, []);

  if (blocked === true) {
    return (
      <div className="mx-auto max-w-3xl py-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Subscription required</p>
        <h1 className="mt-2 text-3xl font-black">Everything you need to get your outlet online</h1>
        <p className="mt-2 text-sm text-stone-400">
          You&apos;re logged in — pick a plan to unlock orders, menu and payments.
        </p>
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <div
              key={id}
              className={`relative rounded-3xl border p-5 ${
                id === "standard" ? "border-orange-500/50 bg-gradient-to-b from-orange-600/15 to-transparent" : "border-white/10 bg-white/[.03]"
              }`}
            >
              {id === "standard" && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-orange-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                  Most popular
                </span>
              )}
              <p className={`text-sm font-black ${id === "standard" ? "text-orange-300" : "text-stone-300"}`}>
                {PLANS[id].name}
              </p>
              <p className="mt-1.5 text-2xl font-black text-white">
                ₹{PLANS[id].monthly.toLocaleString("en-IN")}
                <span className="text-xs font-bold text-stone-500">/mo</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-stone-300">
                {PLANS[id].features.slice(0, 3).map((t) => (
                  <li key={t} className="flex gap-1.5">
                    <span className="text-emerald-300">✓</span> {t}
                  </li>
                ))}
              </ul>
              <Link
                href={`/subscribe?plan=${id}&billing=monthly&next=/dashboard`}
                className={`mt-4 block rounded-2xl py-2.5 text-center text-xs font-black transition active:scale-[.98] ${
                  id === "standard" ? "bg-orange-600 text-white hover:bg-orange-500" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Choose plan →
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-stone-500">UPI, cards & netbanking • Cancel anytime</p>
      </div>
    );
  }

  return (
    <div>
      {sysHealth === "bad" && (
        <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-sm font-bold text-red-200">
          🔴 Something&apos;s wrong on our side — orders may be slow or failing. Don&apos;t change anything;
          take cash/UPI directly, and contact Qtable support. This banner clears itself when systems recover.
        </div>
      )}
      {upiMissing && (
        <Link href="/dashboard/settings" className="mb-4 block rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-bold text-amber-200">
          ⚠️ No UPI ID set — customers can only pay at the counter. Tap here to add it in Settings (30 seconds).
        </Link>
      )}
      {stats?.lowStock && stats.lowStock.length > 0 && (
        <Link href="/dashboard/menu" className="mb-4 block rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-bold text-amber-200">
          ⚠️ Running low: {stats.lowStock.slice(0, 3).map((l) => `${l.name} (${l.stock})`).join(", ")}
          {stats.lowStock.length > 3 ? ` +${stats.lowStock.length - 3} more` : ""} — restock in Menu before the rush.
        </Link>
      )}
      {!guideOff && guide && (!guide.menu || !guide.tables || !guide.team || upiMissing) && (
        <div className="mb-4 rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-600/10 to-transparent p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-black">🚀 Getting started {[guide.menu, guide.tables, guide.team, !upiMissing].filter(Boolean).length}/4</p>
            <button
              onClick={() => { try { localStorage.setItem("qtable_guide_done", "1"); } catch {} setGuideOff(true); }}
              className="text-xs text-stone-500 hover:text-stone-200"
            >
              Dismiss ✕
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { done: !upiMissing, label: "Add your UPI ID", hint: "Settings → payments in 30 seconds", href: "/dashboard/settings" },
              { done: guide.menu, label: "Add menu items", hint: "Photos, prices, categories", href: "/dashboard/menu" },
              { done: guide.tables, label: "Add tables & print QRs", hint: "Laminate + test-scan every table", href: "/dashboard/tables" },
              { done: guide.team, label: "Invite your team", hint: "Counter + kitchen logins", href: "/dashboard/staff" },
            ].map((s) => (
              <Link key={s.label} href={s.href} className="flex items-center gap-3 rounded-2xl bg-black/25 p-3 text-sm transition hover:bg-black/40">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-black ${s.done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-stone-400"}`}>
                  {s.done ? "✓" : "○"}
                </span>
                <span>
                  <span className={`block font-bold ${s.done ? "text-stone-500 line-through" : "text-white"}`}>{s.label}</span>
                  <span className="block text-xs text-stone-400">{s.hint}</span>
                </span>
              </Link>
            ))}
          </div>
          <Link href="/dashboard/guide" className="mt-3 inline-block text-sm font-bold text-orange-400">📖 Open the full owner guide →</Link>
        </div>
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
