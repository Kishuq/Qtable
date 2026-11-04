"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlanGate } from "@/components/PlanGate";
import { EmptyState, SectionTitle, Spinner, useToast } from "@/components/ux";
import { inr } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  lowAt: number;
  available: boolean;
  emoji: string;
  category: string;
};

type Summary = { total: number; tracked: number; low: number; out: number };
type Filter = "all" | "low" | "out" | "untracked";

// Stock control for a busy service: one tap to deduct, one tap to restock.
// Everything is optimistic — the row never waits for the server to feel fast.
function InventoryInner() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState<Summary>({ total: 0, tracked: 0, low: 0, out: 0 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/inventory", { cache: "no-store" });
      if (r.status === 403) { setDenied(true); return; }
      const j = await r.json();
      if (Array.isArray(j.items)) {
        setRows(j.items);
        setSummary(j.summary);
      }
    } catch {
      toast("Couldn't load inventory — check your connection", "err");
    }
  }

  useEffect(() => { load(); }, []);

  function apply(id: string, patch: Partial<Row>) {
    setRows((cur) => (cur ? cur.map((r) => (r.id === id ? { ...r, ...patch } : r)) : cur));
  }

  async function save(id: string, body: Record<string, unknown>, optimistic: Partial<Row>) {
    const before = rows?.find((r) => r.id === id);
    apply(id, optimistic);
    setBusy(id);
    try {
      const r = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Update failed");
      apply(id, {
        stock: j.item?.stock ?? optimistic.stock ?? before?.stock ?? null,
        lowAt: j.item?.lowAt ?? optimistic.lowAt ?? before?.lowAt ?? 5,
        available: j.item?.available ?? optimistic.available ?? before?.available ?? true,
      });
    } catch (e: unknown) {
      if (before) apply(id, before);
      toast(e instanceof Error ? e.message : "Update failed", "err");
    } finally {
      setBusy(null);
    }
  }

  const visible = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !`${r.name} ${r.category}`.toLowerCase().includes(needle)) return false;
      if (filter === "low") return r.stock !== null && r.stock <= r.lowAt;
      if (filter === "out") return r.stock !== null && r.stock <= 0;
      if (filter === "untracked") return r.stock === null;
      return true;
    });
  }, [rows, q, filter]);

  if (denied) {
    return (
      <EmptyState
        emoji="🔒"
        title="Inventory is a Pro feature"
        hint="Upgrade to Pro to track stock, get low-stock alerts and mark items sold out in one tap."
      />
    );
  }

  return (
    <div>
      <SectionTitle
        title="Inventory"
        sub="Live stock counts. Set a threshold once and Qtable warns you before you run out."
        right={<Link href="/dashboard/menu" className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/20">Edit menu →</Link>}
      />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Tracked items", summary.tracked, "📦", "text-white"],
          ["Running low", summary.low, "⚠️", summary.low ? "text-amber-300" : "text-white"],
          ["Sold out", summary.out, "🚫", summary.out ? "text-red-300" : "text-white"],
          ["Not tracked", summary.total - summary.tracked, "○", "text-stone-300"],
        ].map(([label, value, emoji, tone]) => (
          <div key={String(label)} className="glass rounded-3xl p-4">
            <p className="text-xl">{emoji}</p>
            <p className={`mt-1 text-2xl font-black ${tone}`}>{String(value)}</p>
            <p className="text-xs text-stone-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search item or category"
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500"
        />
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {([
            ["all", "All"],
            ["low", `Low ${summary.low || ""}`],
            ["out", `Out ${summary.out || ""}`],
            ["untracked", "Untracked"],
          ] as [Filter, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 ${
                filter === id ? "bg-orange-600 text-white" : "bg-white/5 text-stone-300 hover:bg-white/10"
              }`}
            >
              {label.trim()}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {rows === null && (
          <div className="glass grid place-items-center rounded-3xl py-16"><Spinner /></div>
        )}

        {rows !== null && visible.length === 0 && (
          <EmptyState
            emoji={filter === "all" ? "📦" : "✨"}
            title={filter === "all" ? "Nothing to track yet" : "Nothing in this filter"}
            hint={filter === "all" ? "Add menu items, then set a stock count here or in the menu editor." : "Try another filter — everything looks healthy."}
          />
        )}

        {visible.map((r) => {
          const tracked = r.stock !== null;
          const out = tracked && (r.stock as number) <= 0;
          const low = tracked && !out && (r.stock as number) <= r.lowAt;
          return (
            <div key={r.id} className={`glass rounded-3xl p-4 ${out ? "border-red-500/30" : low ? "border-amber-500/30" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-xl">{r.emoji}</span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{r.name}</p>
                  <p className="text-xs text-stone-400">
                    {r.category || "Uncategorised"} • {inr(r.price)}
                    {out && <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 font-bold text-red-300">Sold out</span>}
                    {low && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">Low</span>}
                    {!r.available && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 font-bold text-stone-300">Hidden</span>}
                  </p>
                </div>

                {tracked ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => save(r.id, { stock: Math.max(0, (r.stock as number) - 1) }, { stock: Math.max(0, (r.stock as number) - 1) })}
                      disabled={busy === r.id}
                      className="grid size-9 place-items-center rounded-xl bg-white/10 text-lg font-black transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                      aria-label={`Remove one ${r.name}`}
                    >
                      −
                    </button>
                    <span className={`w-12 text-center text-lg font-black tnum ${out ? "text-red-300" : low ? "text-amber-300" : ""}`}>
                      {r.stock}
                    </span>
                    <button
                      onClick={() => save(r.id, { stock: (r.stock as number) + 1 }, { stock: (r.stock as number) + 1 })}
                      disabled={busy === r.id}
                      className="grid size-9 place-items-center rounded-xl bg-white/10 text-lg font-black transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                      aria-label={`Add one ${r.name}`}
                    >
                      +
                    </button>
                    <button
                      onClick={() => save(r.id, { stock: (r.stock as number) + 10 }, { stock: (r.stock as number) + 10 })}
                      disabled={busy === r.id}
                      className="rounded-xl bg-orange-600/20 px-3 py-2 text-xs font-black text-orange-300 transition hover:bg-orange-600/30 active:scale-95 disabled:opacity-50"
                    >
                      +10
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => save(r.id, { stock: 10, lowAt: 3 }, { stock: 10 })}
                    disabled={busy === r.id}
                    className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                  >
                    Start tracking
                  </button>
                )}
              </div>

              {tracked && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3 text-xs text-stone-400">
                  <label className="flex items-center gap-2">
                    Warn at
                    <input
                      type="number"
                      min={0}
                      defaultValue={r.lowAt}
                      key={`low-${r.id}-${r.lowAt}`}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        if (v !== r.lowAt) save(r.id, { lowAt: v }, { lowAt: v });
                      }}
                      className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center text-xs font-bold text-white outline-none focus:border-orange-500"
                    />
                  </label>
                  <button
                    onClick={() => save(r.id, { available: !r.available }, { available: !r.available })}
                    className="rounded-lg bg-white/5 px-3 py-1 font-bold transition hover:bg-white/10 active:scale-95"
                  >
                    {r.available ? "Mark sold out" : "Mark available"}
                  </button>
                  <button
                    onClick={() => save(r.id, { stock: null }, { stock: null })}
                    className="font-bold text-stone-500 underline underline-offset-2 hover:text-stone-300"
                  >
                    Stop tracking
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs leading-relaxed text-stone-400">
        Stock counts are independent of the menu&apos;s availability switch: setting a count to zero does not hide the item,
        so customers can still see it with a &quot;sold out&quot; note. Use <b className="text-stone-200">Mark sold out</b> to
        hide it from ordering too. Counts are for your team — customers never see them.
      </p>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <PlanGate>
      <InventoryInner />
    </PlanGate>
  );
}
