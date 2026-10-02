"use client";
import { useEffect, useRef, useState } from "react";
import { inr } from "@/lib/format";
import { ItemPhoto, useToast } from "@/components/ux";

type Item = { id: string; name: string; description: string; price: number; imageEmoji: string; imageUrl: string; veg: boolean; available: boolean; popular: boolean; categoryId: string | null; stock: number | null; lowAt: number };
type Cat = { id: string; name: string };

const EMOJIS = ["☕", "🍵", "🥛", "🧊", "🍹", "🥭", "🍟", "🥪", "🍗", "🍕", "🍫", "🍰", "🧁", "🥐", "🍩"];

export default function MenuPage() {
  const toast = useToast();
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [f, setF] = useState({ name: "", price: "", description: "", categoryId: "", veg: true, popular: false, imageEmoji: "☕", imageUrl: "", stock: "" as string, lowAt: "5" });
  // Inventory controls are Pro-only — everyone else gets the plain menu form.
  // Unknown plan fails open (never hide tools over a network hiccup).
  const [proPlan, setProPlan] = useState(true);
  useEffect(() => {
    fetch("/api/billing/status").then((r) => r.json()).then((j) => { if (j?.plan) setProPlan(j.plan === "pro"); }).catch(() => {});
  }, []);
  const [catName, setCatName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/menu");
    const j = await r.json();
    if (!j.error) { setCats(j.categories); setItems(j.items); if (!f.categoryId && j.categories[0]) setF((p) => ({ ...p, categoryId: j.categories[0].id })); }
  }
  useEffect(() => { load(); }, []);

  const blankForm = { name: "", price: "", description: "", categoryId: "", veg: true, popular: false, imageEmoji: "☕", imageUrl: "", stock: "", lowAt: "5" };

  async function save() {
    if (!f.name || !f.price) return toast("Name + price required", "err");
    const price = Math.round(parseFloat(f.price) * 100);
    if (!price || price < 100) return toast("Enter a valid price in ₹", "err");
    const stock = f.stock.trim() === "" ? null : Math.max(0, Math.floor(Number(f.stock) || 0));
    const lowAt = Math.max(0, Math.floor(Number(f.lowAt) || 5));
    setSaving(true);
    try {
      const r = await fetch("/api/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing || "", name: f.name, description: f.description, price, categoryId: f.categoryId, veg: f.veg, popular: f.popular, imageEmoji: f.imageEmoji, imageUrl: f.imageUrl, available: true, stock, lowAt }) });
      const j = await r.json();
      if (!r.ok) return toast(j.error || "Save failed", "err");
      toast(editing ? "Item updated ✓" : `${f.name} is live on the menu 🎉`);
      setF({ ...blankForm, categoryId: f.categoryId });
      setEditing(null); load();
    } finally { setSaving(false); }
  }

  async function toggle(id: string, field: "available" | "popular", itemsNow: Item[]) {
    const it = itemsNow.find((i) => i.id === id)!;
    const key = `${id}:${field}`;
    setBusy(key);
    // Optimistic flip — toggle answers instantly.
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p)));
    try {
      await fetch("/api/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: it.name, description: it.description, price: it.price, categoryId: it.categoryId || "", veg: it.veg, available: field === "available" ? !it.available : it.available, popular: field === "popular" ? !it.popular : it.popular, imageEmoji: it.imageEmoji, imageUrl: it.imageUrl || "" }) });
    } finally { setBusy(null); load(); }
  }

  async function adjustStock(id: string, delta: number) {
    const key = `${id}:stock`;
    setBusy(key);
    try {
      const it = items.find((x) => x.id === id);
      const next = Math.max(0, (it?.stock ?? 0) + delta);
      const r = await fetch("/api/menu", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: it!.name, description: it!.description, price: it!.price, categoryId: it!.categoryId || "", veg: it!.veg, available: it!.available, popular: it!.popular, imageEmoji: it!.imageEmoji, imageUrl: it!.imageUrl || "", stock: next, lowAt: it!.lowAt ?? 5 }),
      });
      if (!r.ok) toast("Stock update failed", "err");
      load();
    } finally { setBusy(null); }
  }

  async function removeItem(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    setBusy(`${id}:delete`);
    try {
      await fetch(`/api/menu?id=${id}`, { method: "DELETE" });
      toast(`${name} deleted`, "info");
    } finally { setBusy(null); load(); }
  }

  async function addCategory() {
    if (!catName.trim()) return;
    setBusy("cat:add");
    try {
      await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: catName }) });
      setCatName("");
      toast("Category added ✓");
    } finally { setBusy(null); load(); }
  }

  return (
    <div>
      <h1 className="text-2xl font-black">Menu manager 🍽️</h1>
      <div className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="glass h-fit rounded-3xl p-5">
          <p className="font-black">{editing ? "Edit item" : "Add item"}</p>
          <div className="mt-3 space-y-2">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name (Cappuccino)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
            <div className="flex gap-2">
              <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Price ₹" inputMode="decimal" className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
              <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className="flex-1 rounded-2xl border border-white/10 bg-stone-900 px-3 py-2.5 text-sm">
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Short description" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
            <div className="flex gap-2">
              <input value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} placeholder="Photo URL (https://…) — or upload ↓" className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
              {f.imageUrl.startsWith("http") && <img src={f.imageUrl} alt="" className="size-11 rounded-xl object-cover" />}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[.03] px-4 py-2.5 text-xs font-bold text-stone-300 transition hover:bg-white/[.07] active:scale-[.99] disabled:opacity-60"
            >
              {uploading ? "Uploading… ⏳" : "📷 Upload photo — gallery opens, pick one, done"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append("photo", file);
                    const r = await fetch("/api/menu/photo", { method: "POST", body: fd });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) throw new Error(j.error || "Upload failed");
                    setF((p) => ({ ...p, imageUrl: j.url }));
                    toast("Photo uploaded ✓");
                  } catch (err: unknown) {
                    toast(err instanceof Error ? err.message : "Upload failed", "err");
                  } finally { setUploading(false); }
                }}
              />
            <div className="flex flex-wrap gap-1.5">{EMOJIS.map((e) => <button key={e} onClick={() => setF({ ...f, imageEmoji: e })} className={`rounded-xl border p-1.5 text-lg ${f.imageEmoji === e ? "border-orange-500 bg-orange-500/15" : "border-white/10"}`}>{e}</button>)}</div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.veg} onChange={(e) => setF({ ...f, veg: e.target.checked })} /> Veg</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.popular} onChange={(e) => setF({ ...f, popular: e.target.checked })} /> Popular ⭐</label>
            </div>
            {proPlan ? (
              <div className="flex gap-2">
                <label className="flex-1 text-xs font-bold text-stone-400">STOCK
                  <input value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="Blank = don't track" inputMode="numeric" className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-orange-500" />
                </label>
                <label className="w-24 text-xs font-bold text-stone-400">ALERT AT
                  <input value={f.lowAt} onChange={(e) => setF({ ...f, lowAt: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="5" inputMode="numeric" className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-orange-500" />
                </label>
              </div>
            ) : (
              <p className="rounded-2xl bg-white/5 p-3 text-xs text-stone-500">📦 Stock tracking is Pro — <span className="font-bold text-orange-400">upgrade</span> to auto-hide sold-out items.</p>
            )}
            <button onClick={save} disabled={saving} className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-black transition hover:brightness-110 active:scale-[.99] disabled:opacity-60">{saving ? "Saving… ⏳" : editing ? "Save changes" : "+ Add to menu"}</button>
            {editing && <button onClick={() => { setEditing(null); setF({ ...blankForm, categoryId: f.categoryId }); }} className="w-full text-xs text-stone-400">Cancel edit</button>}
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-sm font-black">Categories</p>
            <div className="mt-2 flex gap-2">
              <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category" className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none" />
              <button onClick={addCategory} disabled={busy === "cat:add"} className="rounded-2xl bg-white/10 px-4 text-sm font-bold transition hover:bg-white/20 active:scale-95 disabled:opacity-60">{busy === "cat:add" ? "… ⏳" : "Add"}</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{cats.map((c) => <span key={c.id} className="rounded-full bg-white/5 px-3 py-1 text-xs">{c.name}</span>)}</div>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((i) => (
            <div key={i.id} className={`glass flex items-center gap-3 rounded-2xl p-3 ${i.available ? "" : "opacity-50"}`}>
              <ItemPhoto url={i.imageUrl} emoji={i.imageEmoji} size="size-11" rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{i.name} {i.popular && "⭐"}
                  {i.stock !== null && i.stock !== undefined && (
                    i.stock <= 0
                      ? <span className="ml-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-black text-red-300">86&apos;d</span>
                      : i.stock <= (i.lowAt ?? 5)
                        ? <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300">Low {i.stock}</span>
                        : <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-stone-300">{i.stock} left</span>
                  )}
                </p>
                <p className="text-xs text-stone-400">{inr(i.price)} • {cats.find((c) => c.id === i.categoryId)?.name || "—"}</p>
                {proPlan && i.stock !== null && i.stock !== undefined && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <button onClick={() => adjustStock(i.id, -1)} disabled={busy === `${i.id}:stock`} className="grid size-6 place-items-center rounded-full bg-white/10 text-sm font-black transition hover:bg-white/20 active:scale-90 disabled:opacity-60">−</button>
                    <button onClick={() => adjustStock(i.id, 1)} disabled={busy === `${i.id}:stock`} className="grid size-6 place-items-center rounded-full bg-white/10 text-sm font-black transition hover:bg-white/20 active:scale-90 disabled:opacity-60">+</button>
                  </div>
                )}
              </div>
              <button onClick={() => toggle(i.id, "available", items)} disabled={busy === `${i.id}:available`} className={`rounded-full px-3 py-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-60 ${i.available ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-stone-400"}`}>{busy === `${i.id}:available` ? "… ⏳" : i.available ? "LIVE" : "HIDDEN"}</button>
              <button onClick={() => { setEditing(i.id); setF({ name: i.name, price: String(i.price / 100), description: i.description, categoryId: i.categoryId || "", veg: i.veg, popular: i.popular, imageEmoji: i.imageEmoji, imageUrl: i.imageUrl || "", stock: i.stock === null || i.stock === undefined ? "" : String(i.stock), lowAt: String(i.lowAt ?? 5) }); }} className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold transition hover:bg-white/20 active:scale-95">Edit</button>
              <button onClick={() => removeItem(i.id, i.name)} disabled={busy === `${i.id}:delete`} className="text-stone-500 transition hover:text-red-400 active:scale-90 disabled:opacity-60">{busy === `${i.id}:delete` ? "⏳" : "🗑"}</button>
            </div>
          ))}
          {items.length === 0 && <p className="py-10 text-center text-sm text-stone-500">No items yet — add your first dish. 👨‍🍳</p>}
        </div>
      </div>
    </div>
  );
}
