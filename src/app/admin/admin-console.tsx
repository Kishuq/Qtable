"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { inr, fdate } from "@/lib/format";
import { PLANS, type PlanId } from "@/lib/plans";

export type AdminCafe = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName: string;
  plan: string;
  status: string;
  billing: string;
  paidUntil: string | null;
  autoRenew: boolean;
  createdAt: string;
  isActive: boolean;
  orders: number;
  items: number;
  tables: number;
  mrr: number;
};

export type AdminEvent = {
  id: string;
  cafeId: string;
  cafeName: string;
  kind: string;
  plan: string;
  billing: string;
  amount: number;
  ref: string;
  createdAt: string;
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-200",
  past_due: "bg-red-500/15 text-red-300",
  canceled: "bg-stone-500/15 text-stone-300",
};

const PLAN_LABEL: Record<string, string> = { menu: "Basic", standard: "Standard", pro: "Pro" };

// Secure-context UUID with a fallback for older mobile browsers. Used only for
// admin-action idempotency, never as a secret.
function newKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `admin:${c.randomUUID()}`;
  return `admin:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function AdminConsole({ adminEmail, cafes, events, totals }: {
  adminEmail: string;
  cafes: AdminCafe[];
  events: AdminEvent[];
  totals: { outlets: number; active: number; pastDue: number; pending: number; mrr: number };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [planFor, setPlanFor] = useState<Record<string, string>>({});
  const [billingFor, setBillingFor] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cafes.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!needle) return true;
      return `${c.name} ${c.slug} ${c.ownerEmail} ${c.ownerName}`.toLowerCase().includes(needle);
    });
  }, [cafes, q, status]);

  async function act(cafe: AdminCafe, action: "activate" | "extend" | "cancel" | "resume" | "comp") {
    const key = `${cafe.id}:${action}`;
    setBusy(key);
    setMsg(null);
    try {
      const plan = planFor[cafe.id] || cafe.plan;
      const billing = billingFor[cafe.id] || cafe.billing;
      type Body = { action: "activate" | "extend" | "cancel" | "resume"; plan?: string; billing?: string; months?: number; note?: string; txnKey: string };
      const txnKey = newKey();
      let body: Body;
      if (action === "cancel" || action === "resume") {
        body = { action, txnKey };
      } else if (action === "comp") {
        body = { action: "activate", plan: cafe.plan, billing: cafe.billing, months: 0, note: "complimentary", txnKey };
      } else if (action === "extend") {
        body = { action: "extend", months: 1, txnKey };
      } else {
        body = { action: "activate", plan, billing, txnKey };
      }

      const r = await fetch(`/api/admin/cafe/${encodeURIComponent(cafe.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Action failed");
      setMsg({ text: `${cafe.name}: ${action} ✓` });
      router.refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Action failed", bad: true });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400">Platform console</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Outlets & revenue</h1>
          <p className="mt-1 text-sm text-stone-400">Signed in as {adminEmail}. Actions are audit-logged.</p>
        </div>
        <a href="/dashboard" className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/15">
          ← My dashboard
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Outlets" value={String(totals.outlets)} hint={`${totals.active} active`} />
        <Stat label="MRR" value={inr(totals.mrr)} hint="normalised monthly, active only" />
        <Stat label="Payment due" value={String(totals.pastDue)} hint="dunning / past_due" tone="text-amber-300" />
        <Stat label="Preview" value={String(totals.pending)} hint="signed up, not subscribed" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search outlet, slug or owner email…"
          className="min-w-[240px] flex-1 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm outline-none placeholder:text-stone-500 focus:border-orange-500/60"
        />
        <div className="flex gap-1 rounded-2xl bg-white/[.04] p-1">
          {["all", "active", "pending", "past_due", "canceled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black capitalize transition ${status === s ? "bg-orange-600 text-white" : "text-stone-400 hover:text-white"}`}
            >
              {s === "past_due" ? "due" : s}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <p className={`mt-3 rounded-2xl p-3 text-sm ${msg.bad ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{msg.text}</p>
      )}

      <div className="mt-4 space-y-2">
        {filtered.length === 0 && <p className="rounded-3xl bg-white/[.03] p-8 text-center text-sm text-stone-500">No outlets match.</p>}
        {filtered.map((c) => {
          const tone = STATUS_TONE[c.status] || "bg-white/10 text-stone-300";
          return (
            <div key={c.id} className="rounded-3xl border border-white/[.06] bg-white/[.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-black">{c.name}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${tone}`}>{c.status}</span>
                    {c.autoRenew && <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-black text-sky-300">auto-renew</span>}
                    {c.mrr > 0 && <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-300">{inr(c.mrr)}/mo</span>}
                  </div>
                  <p className="mt-1 text-xs text-stone-400">
                    /t/{c.slug} · {c.ownerEmail || "no owner email"}
                    {c.ownerName ? ` (${c.ownerName})` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {PLAN_LABEL[c.plan] || c.plan} · {c.billing} · paid until {c.paidUntil ? fdate(c.paidUntil) : "—"} · joined {fdate(c.createdAt)}
                  </p>
                  <p className="mt-1 text-[11px] text-stone-500">
                    {c.orders} orders · {c.items} menu items · {c.tables} tables
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={planFor[c.id] || c.plan}
                    onChange={(e) => setPlanFor((m) => ({ ...m, [c.id]: e.target.value }))}
                    className="rounded-xl border border-white/10 bg-stone-900 px-2 py-1.5 text-xs font-bold"
                  >
                    {(["menu", "standard", "pro"] as PlanId[]).map((p) => (
                      <option key={p} value={p}>{PLANS[p].name}</option>
                    ))}
                  </select>
                  <select
                    value={billingFor[c.id] || c.billing}
                    onChange={(e) => setBillingFor((m) => ({ ...m, [c.id]: e.target.value }))}
                    className="rounded-xl border border-white/10 bg-stone-900 px-2 py-1.5 text-xs font-bold"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <button
                    disabled={busy === `${c.id}:activate`}
                    onClick={() => act(c, "activate")}
                    className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-orange-500 disabled:opacity-50"
                  >
                    Activate
                  </button>
                  <button
                    disabled={busy === `${c.id}:extend`}
                    onClick={() => act(c, "extend")}
                    className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-black transition hover:bg-white/15 disabled:opacity-50"
                  >
                    +1 month
                  </button>
                  <button
                    disabled={busy === `${c.id}:comp`}
                    onClick={() => act(c, "comp")}
                    className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-black transition hover:bg-white/15 disabled:opacity-50"
                  >
                    Comp
                  </button>
                  {c.status === "canceled" || c.status === "past_due" ? (
                    <button
                      disabled={busy === `${c.id}:resume`}
                      onClick={() => act(c, "resume")}
                      className="rounded-xl bg-emerald-600/80 px-3 py-1.5 text-xs font-black text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Resume
                    </button>
                  ) : (
                    <button
                      disabled={busy === `${c.id}:cancel`}
                      onClick={() => act(c, "cancel")}
                      className="rounded-xl bg-red-600/20 px-3 py-1.5 text-xs font-black text-red-300 transition hover:bg-red-600/30 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <p className="mb-2 text-sm font-black">Recent billing events</p>
        <div className="overflow-hidden rounded-3xl border border-white/[.06] bg-white/[.03]">
          {events.length === 0 ? (
            <p className="p-6 text-sm text-stone-500">No billing activity yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-stone-300">{e.kind}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{e.cafeName}</p>
                    <p className="truncate text-[11px] text-stone-500">{fdate(e.createdAt)} {e.ref ? `· ${e.ref}` : ""}</p>
                  </div>
                  <p className="text-sm font-black">{e.amount > 0 ? inr(e.amount) : "—"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-3xl border border-white/[.06] bg-white/[.03] p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone || ""}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-stone-500">{hint}</p>
    </div>
  );
}
