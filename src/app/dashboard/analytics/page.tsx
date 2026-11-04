"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PlanGate } from "@/components/PlanGate";
import { EmptyState, SectionTitle, Spinner } from "@/components/ux";
import { inr, timeAgo } from "@/lib/format";

type Data = {
  days: number;
  totals: {
    revenue: number; orders: number; avgTicket: number; paid: number; unpaid: number;
    avgRating: number; feedbackCount: number; peakHour: number | null;
  };
  daily: { day: string; label: string; revenue: number; orders: number }[];
  hourly: number[];
  modes: { COUNTER: number; UPI: number; ONLINE: number };
  topItems: { name: string; qty: number }[];
  feedbacks: { id: string; rating: number; comment: string; createdAt: string }[];
};

function hourLabel(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${base}${suffix}`;
}

function InsightsInner() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let stop = false;
    setLoading(true);
    fetch(`/api/analytics/detail?days=${days}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 403) { if (!stop) setDenied(true); return null; }
        return r.json();
      })
      .then((j) => { if (!stop && j && !j.error) setData(j); })
      .catch(() => {})
      .finally(() => { if (!stop) setLoading(false); });
    return () => { stop = true; };
  }, [days]);

  if (denied) {
    return (
      <EmptyState
        emoji="🔒"
        title="Insights is a Pro feature"
        hint="Upgrade to Pro for revenue trends, peak hours, payment mix and customer feedback."
      />
    );
  }

  const maxRevenue = Math.max(1, ...(data?.daily.map((d) => d.revenue) || [1]));
  const maxHour = Math.max(1, ...(data?.hourly || [1]));
  const orders = data?.totals.orders || 0;
  const modeTotal = data ? data.modes.COUNTER + data.modes.UPI + data.modes.ONLINE : 0;

  return (
    <div>
      <SectionTitle
        title="Insights"
        sub="Where the money comes from, when the rush hits, and what customers say."
        right={
          <div className="flex rounded-full bg-white/5 p-1">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-full px-4 py-1.5 text-xs font-black transition active:scale-95 ${days === d ? "bg-orange-600 text-white" : "text-stone-400 hover:text-white"}`}
              >
                {d} days
              </button>
            ))}
          </div>
        }
      />

      {loading && !data && <div className="glass mt-4 grid place-items-center rounded-3xl py-20"><Spinner /></div>}

      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Revenue", inr(data.totals.revenue), "💰", "text-emerald-300"],
              ["Orders", String(data.totals.orders), "🧾", "text-white"],
              ["Avg bill", inr(data.totals.avgTicket), "🧮", "text-white"],
              ["Rating", data.totals.feedbackCount ? `${data.totals.avgRating} ⭐` : "—", "❤️", "text-amber-300"],
            ].map(([label, value, emoji, tone]) => (
              <div key={label} className="glass rounded-3xl p-4">
                <p className="text-xl">{emoji}</p>
                <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
                <p className="text-xs text-stone-400">{label}</p>
              </div>
            ))}
          </div>

          {data.totals.unpaid > 0 && (
            <p className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-200">
              {inr(data.totals.unpaid)} of this period is still marked unpaid — open Orders and confirm counter/UPI
              collections so the books match the till.
            </p>
          )}

          {orders === 0 ? (
            <div className="mt-4">
              <EmptyState
                emoji="📈"
                title="No orders in this period yet"
                hint="Insights fill in as soon as your first table orders. Everything here is live — no exports needed."
              />
            </div>
          ) : (
            <>
              <div className="glass mt-4 rounded-3xl p-5">
                <div className="flex items-baseline justify-between">
                  <p className="font-black">Revenue by day</p>
                  <p className="text-xs text-stone-400">peak {inr(maxRevenue)}</p>
                </div>
                <div className="mt-4 flex h-40 items-end gap-1">
                  {data.daily.map((d, i) => {
                    const pct = Math.max(2, Math.round((d.revenue / maxRevenue) * 100));
                    const showLabel = data.days <= 7 || i % 5 === 0 || i === data.daily.length - 1;
                    return (
                      <div key={d.day} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.day} • ${inr(d.revenue)} • ${d.orders} orders`}>
                        <span className="text-[9px] font-bold text-stone-400 opacity-0 transition group-hover:opacity-100">
                          {d.revenue > 0 ? inr(d.revenue) : ""}
                        </span>
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 ${d.revenue > 0 ? "bg-gradient-to-t from-orange-700 to-amber-400" : "bg-white/5"}`}
                          style={{ height: `${pct}%` }}
                        />
                        <span className={`h-3 text-[9px] font-bold ${showLabel ? "text-stone-500" : "text-transparent"}`}>
                          {data.days <= 7 ? d.label : d.day.slice(8)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="glass rounded-3xl p-5">
                  <p className="font-black">Busiest hours</p>
                  <p className="text-xs text-stone-400">
                    {data.totals.peakHour !== null ? `Peak around ${hourLabel(data.totals.peakHour)} — staff up before it.` : "Not enough data yet."}
                  </p>
                  <div className="mt-4 flex h-24 items-end gap-0.5">
                    {data.hourly.map((n, h) => (
                      <div key={h} className="flex-1" title={`${hourLabel(h)} • ${n} orders`}>
                        <div
                          className={`w-full rounded-sm ${n === Math.max(...data.hourly) && n > 0 ? "bg-orange-500" : "bg-white/15"}`}
                          style={{ height: `${Math.max(2, (n / maxHour) * 88)}px` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] font-bold text-stone-500">
                    <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                  </div>
                </div>

                <div className="glass rounded-3xl p-5">
                  <p className="font-black">How customers paid</p>
                  <div className="mt-4 space-y-3">
                    {([
                      ["Counter", data.modes.COUNTER, "bg-stone-400"],
                      ["UPI", data.modes.UPI, "bg-emerald-500"],
                      ["Online", data.modes.ONLINE, "bg-orange-500"],
                    ] as [string, number, string][]).map(([label, n, color]) => {
                      const pct = modeTotal ? Math.round((n / modeTotal) * 100) : 0;
                      return (
                        <div key={label}>
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-stone-300">{label}</span>
                            <span className="text-stone-400">{n} • {pct}%</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[11px] text-stone-500">
                    Online needs a connected gateway; UPI here includes manual &quot;I&apos;ve paid&quot; orders.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="glass rounded-3xl p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-black">Best sellers</p>
                    <Link href="/dashboard/inventory" className="text-xs font-bold text-orange-400">Stock →</Link>
                  </div>
                  <div className="mt-3 space-y-2">
                    {data.topItems.map((t, i) => {
                      const max = Math.max(1, ...data.topItems.map((x) => x.qty));
                      return (
                        <div key={t.name} className="flex items-center gap-3">
                          <span className="w-4 text-xs font-black text-stone-500">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between text-sm">
                              <span className="truncate font-bold">{t.name}</span>
                              <b className="text-stone-300">{t.qty}</b>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-orange-500/70" style={{ width: `${(t.qty / max) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass rounded-3xl p-5">
                  <p className="font-black">Recent feedback</p>
                  <div className="mt-3 space-y-2">
                    {data.feedbacks.length === 0 && <p className="py-6 text-center text-sm text-stone-500">No feedback yet.</p>}
                    {data.feedbacks.slice(0, 5).map((f) => (
                      <div key={f.id} className="rounded-2xl bg-white/[.04] p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p>{"⭐".repeat(Math.min(5, f.rating))}</p>
                          <span className="text-[10px] text-stone-500">{timeAgo(f.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-stone-300">{f.comment || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <PlanGate>
      <InsightsInner />
    </PlanGate>
  );
}
