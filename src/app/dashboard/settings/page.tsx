"use client";
import { useEffect, useState } from "react";
import { CURRENCIES } from "@/lib/format";

export default function SettingsPage() {
  const [f, setF] = useState({ name: "", tagline: "", description: "", upiId: "", gstPct: 5, currency: "INR" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/cafe").then((r) => r.json()).then((j) => {
      if (j.cafe) setF({ name: j.cafe.name, tagline: j.cafe.tagline, description: j.cafe.description, upiId: j.cafe.upiId, gstPct: j.cafe.gstPct, currency: j.cafe.currency || "INR" });
    }).catch(() => {});
  }, []);

  async function save() {
    setMsg("");
    const r = await fetch("/api/cafe", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, tagline: f.tagline, description: f.description, upiId: f.upiId, gstPct: Number(f.gstPct), currency: f.currency }) });
    const j = await r.json();
    setMsg(r.ok ? "✅ Saved! Prices across the menu update instantly." : `❌ ${j.error || "Failed"}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-black">Settings ⚙️</h1>
      <div className="glass mt-4 space-y-3 rounded-3xl p-6">
        <div><label className="text-xs font-bold text-stone-400">CAFE NAME</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" /></div>
        <div><label className="text-xs font-bold text-stone-400">TAGLINE</label><input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" /></div>
        <div><label className="text-xs font-bold text-stone-400">DESCRIPTION</label><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-bold text-stone-400">CURRENCY 🌍</label>
            <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-stone-900 px-4 py-2.5 text-sm outline-none">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-stone-400">TAX % (GST / VAT / SALES TAX)</label><input type="number" min={0} max={30} value={f.gstPct} onChange={(e) => setF({ ...f, gstPct: Number(e.target.value) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" /></div>
        </div>
        <div><label className="text-xs font-bold text-stone-400">UPI ID — INDIA (INR) ONLY</label><input value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} placeholder="outlet@upi" className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
          {f.currency !== "INR" && <p className="mt-1 text-[11px] text-stone-500">UPI auto-hides for non-INR outlets — US/EU outlets use card checkout via Stripe.</p>}</div>
        <button onClick={save} className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-black">Save settings</button>
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <div className="glass mt-4 rounded-3xl p-6 text-sm">
        <p className="font-black">🔗 Your customer link</p>
        <p className="mt-1 break-all text-orange-300">Home: / — tables at /t/T1 … /t/T12 (print these QRs!)</p>
        <p className="mt-3 font-black">💳 Payments — zero friction, zero cheating</p>
        <p className="mt-1 text-stone-400"><b>UPI (no setup):</b> customer pays your QR and taps “I’ve Paid” — order fires instantly, you tap <b>✓ Received</b> when the credit lands (you’re watching live orders anyway). <b>Fully automatic:</b> add <b>RAZORPAY_KEY_ID + SECRET</b> → inline UPI/cards with server-verified signature, PAID with zero taps. Or <b>STRIPE_SECRET_KEY</b> → hosted checkout + webhook (/api/pay/stripe/webhook). The ONLINE button appears only when a gateway is connected.</p>
        <p className="mt-3 font-black">🛡️ Security checklist</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-stone-400">
          <li>Set a 32+ char JWT_SECRET in production + HTTPS only cookies</li>
          <li>Deploy behind Vercel/Cloudflare for DDoS + WAF</li>
          <li>Switch DATABASE_URL to Postgres + run prisma migrate</li>
          <li>Create STAFF/KITCHEN logins with limited roles</li>
        </ul>
      </div>
    </div>
  );
}
