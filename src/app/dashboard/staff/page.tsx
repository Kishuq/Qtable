"use client";
import { useEffect, useState } from "react";
import { EmptyState, SectionTitle, useToast } from "@/components/ux";
import { StatusPill } from "@/components/StatusPill";
import { PlanGate } from "@/components/PlanGate";

type Member = { id: string; name: string; email: string; role: string; createdAt: string };

const ROLES: Record<string, { emoji: string; desc: string }> = {
  OWNER: { emoji: "👑", desc: "Everything" },
  STAFF: { emoji: "🧾", desc: "Counter orders + menu" },
  KITCHEN: { emoji: "👨‍🍳", desc: "Kitchen display only" },
};

export default function StaffPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<Member[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/staff");
    const j = await r.json();
    if (!j.error) setStaff(j.staff);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setSaving(true);
    try {
      const r = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) return toast(j.error || "Failed", "err");
      toast(`${j.staff.name} can now log in 🎉`);
      setF({ name: "", email: "", password: "", role: "STAFF" }); load();
    } finally { setSaving(false); }
  }

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.name}?`)) return;
    setBusy(m.id);
    try {
      await fetch(`/api/staff?id=${m.id}`, { method: "DELETE" });
      toast("Login removed", "info");
    } finally { setBusy(null); load(); }
  }

  return (
    <PlanGate>
    <div>
      <SectionTitle title="Team & logins 👥" sub="Give counter staff and kitchen their own logins — stop sharing one password." />
      <div className="glass mt-4 rounded-3xl p-5">
        <p className="text-sm font-black">Add team member</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name (Ravi — counter)" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
          <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="Email / login id" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
          <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} type="password" placeholder="Password (min 8 chars)" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
          <div className="grid grid-cols-2 gap-2">
            {(["STAFF", "KITCHEN"] as const).map((r) => (
              <button key={r} onClick={() => setF({ ...f, role: r })} className={`rounded-2xl border py-2.5 text-xs font-black ${f.role === r ? "border-orange-500 bg-orange-500/15 text-orange-200" : "border-white/10 text-stone-400"}`}>
                {ROLES[r].emoji} {r}
              </button>
            ))}
          </div>
        </div>
        <button onClick={add} disabled={saving} className="mt-3 w-full rounded-2xl bg-orange-600 py-3 text-sm font-black transition hover:brightness-110 active:scale-[.99] disabled:opacity-60 sm:w-auto sm:px-8">{saving ? "Creating… ⏳" : "+ Create login"}</button>
      </div>

      <div className="mt-4 space-y-2">
        {staff.map((m) => (
          <div key={m.id} className="glass flex items-center gap-3 rounded-2xl p-4">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/5 text-2xl">{ROLES[m.role]?.emoji || "🧑"}</span>
            <div className="flex-1"><p className="text-sm font-bold">{m.name}</p><p className="text-xs text-stone-400">{m.email}</p></div>
            <StatusPill status={m.role} />
            {m.role !== "OWNER" && (
              <button onClick={() => removeMember(m)} disabled={busy === m.id} className="text-xs text-stone-500 transition hover:text-red-400 active:scale-95 disabled:opacity-60">{busy === m.id ? "… ⏳" : "Remove"}</button>
            )}
          </div>
        ))}
      </div>
      {staff.length === 0 && <div className="mt-4"><EmptyState emoji="👥" title="Just you for now" hint="Add your counter + kitchen crew so everyone has their own login." /></div>}
    </div>
    </PlanGate>
  );
}
