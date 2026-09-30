"use client";
import { useEffect, useState } from "react";
import { CURRENCIES } from "@/lib/format";

export default function SettingsPage() {
  const [f, setF] = useState({ name: "", tagline: "", description: "", upiId: "", gstPct: 5, currency: "INR" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [gw, setGw] = useState({ configured: false, fromEnv: false, live: false, keyIdMasked: "" });
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [liveMode, setLiveMode] = useState(false);
  const [gwBusy, setGwBusy] = useState(false);
  const [gwMsg, setGwMsg] = useState("");

  async function loadGateway() {
    try {
      const r = await fetch("/api/payments/config");
      const j = await r.json();
      if (!j.error) setGw({ configured: j.configured, fromEnv: j.fromEnv, live: j.live, keyIdMasked: j.keyIdMasked || "" });
    } catch { /* offline */ }
  }

  useEffect(() => { loadGateway(); }, []);

  async function connectGateway() {
    setGwMsg("");
    setGwBusy(true);
    try {
      const r = await fetch("/api/payments/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: keyId.trim(), keySecret: keySecret.trim(), live: liveMode }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Verification failed");
      setKeyId(""); setKeySecret("");
      setGwMsg(`✅ Gateway connected (${j.live ? "LIVE — real money" : "TEST — try it with test payments"}). UPI auto-checkout is on.`);
      loadGateway();
    } catch (e: unknown) {
      setGwMsg(`❌ ${e instanceof Error ? e.message : "Verification failed"}`);
    } finally { setGwBusy(false); }
  }

  async function disconnectGateway() {
    if (!confirm("Disconnect the payment gateway? Customers fall back to Cash + manual UPI.")) return;
    setGwBusy(true);
    try {
      await fetch("/api/payments/config", { method: "DELETE" });
      setGwMsg("Gateway disconnected — Cash + manual UPI only.");
      loadGateway();
    } finally { setGwBusy(false); }
  }

  useEffect(() => {
    fetch("/api/cafe").then((r) => r.json()).then((j) => {
      if (j.cafe) setF({ name: j.cafe.name, tagline: j.cafe.tagline, description: j.cafe.description, upiId: j.cafe.upiId, gstPct: j.cafe.gstPct, currency: j.cafe.currency || "INR" });
    }).catch(() => {});
  }, []);

  async function save() {
    setMsg("");
    setSaving(true);
    try {
      const r = await fetch("/api/cafe", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, tagline: f.tagline, description: f.description, upiId: f.upiId, gstPct: Number(f.gstPct), currency: f.currency }) });
      const j = await r.json();
      setMsg(r.ok ? "✅ Saved! Prices across the menu update instantly." : `❌ ${j.error || "Failed"}`);
    } finally { setSaving(false); }
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
        <div><label className="text-xs font-bold text-stone-400">UPI ID — INDIA (INR) ONLY</label>
          <div className="mt-1 flex gap-2">
            <input value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} placeholder="outlet@upi" className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
            {f.upiId && (
              <button onClick={() => { if (!confirm("Remove UPI ID? Customers will only see Cash/Counter until you add a new one.")) return; setF({ ...f, upiId: "" }); }} className="shrink-0 rounded-2xl border border-red-500/40 px-4 text-xs font-bold text-red-300 transition hover:bg-red-500/10 active:scale-95">
                Remove ✕
              </button>
            )}
          </div>
          {f.currency !== "INR" && <p className="mt-1 text-[11px] text-stone-500">UPI auto-hides for non-INR outlets — US/EU outlets use card checkout via Stripe.</p>}</div>
        <button onClick={save} disabled={saving} className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-black transition hover:brightness-110 active:scale-[.99] disabled:opacity-60">{saving ? "Saving… ⏳" : "Save settings"}</button>
        {msg && <p className="text-sm">{msg}</p>}
      </div>

      <div className="glass mt-4 rounded-3xl p-6">
        <p className="font-black">💳 Online payments — Razorpay self-setup</p>
        <p className="mt-1 text-sm text-stone-400">
          Paste your own Razorpay keys — we verify them live, store the secret encrypted, and UPI auto-checkout
          switches on instantly. No developer, no redeploy.
        </p>
        {gw.configured ? (
          <div className="mt-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            <p className="font-black text-emerald-200">
              {gw.live ? "● LIVE — accepting real money" : "● TEST — verify with test payments"}
              {gw.fromEnv ? " (keys from server env)" : ` (${gw.keyIdMasked})`}
            </p>
            {!gw.fromEnv && (
              <button onClick={disconnectGateway} disabled={gwBusy} className="mt-2 rounded-xl border border-red-500/40 px-4 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/10 active:scale-95 disabled:opacity-60">
                {gwBusy ? "… ⏳" : "Disconnect gateway"}
              </button>
            )}
            {gw.fromEnv && <p className="mt-1 text-[11px] text-stone-400">Managed via server env vars — remove them there to use self-serve keys.</p>}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <input value={keyId} onChange={(e) => setKeyId(e.target.value.trim())} placeholder="Razorpay Key ID (rzp_test_… / rzp_live_…)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
            <input value={keySecret} onChange={(e) => setKeySecret(e.target.value)} type="password" placeholder="Razorpay Key Secret (paste once — never shown again)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-orange-500" />
            <label className="flex items-center gap-2 text-xs font-bold text-stone-300">
              <input type="checkbox" checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
              These are LIVE keys (real money) — leave off for test mode
            </label>
            <button onClick={connectGateway} disabled={gwBusy || !keyId.trim() || !keySecret.trim()} className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-black transition hover:brightness-110 active:scale-[.99] disabled:opacity-60">
              {gwBusy ? "Verifying with Razorpay… ⏳" : "Verify & enable payments →"}
            </button>
            {gwMsg && <p className="text-sm">{gwMsg}</p>}
            <p className="text-[11px] text-stone-500">Get keys: Razorpay Dashboard → Settings → API Keys. Start in test mode, flip to live after KYC.</p>
          </div>
        )}
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
