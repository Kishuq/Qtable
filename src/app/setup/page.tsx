"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SetupInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const paidFirst = sp.get("paid") === "1";
  const prefillEmail = sp.get("email") || "";
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ cafeName: "", name: "", email: "", password: "", upiId: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillEmail) setForm((p) => ({ ...p, email: prefillEmail }));
    const gname = sp.get("gname") || "";
    if (gname) setForm((p) => ({ ...p, name: p.name || gname }));
    fetch("/api/setup").then(async (r) => {
      const j = await r.json();
      if (!j.needsSetup) router.replace("/login");
      else setChecking(false);
    }).catch(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) {
        // 402 = subscription gate — forward to /subscribe, then back here.
        if (r.status === 402 && j.redirect) {
          router.push(`${j.redirect}?next=/setup`);
          router.refresh();
          return;
        }
        throw new Error(j.error || "Setup failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Setup failed");
    } finally { setLoading(false); }
  }

  if (checking) return <div className="mx-auto flex-1 py-20 text-center text-stone-400">Checking… ☕</div>;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="glass rounded-3xl p-8">
        <p className="text-4xl">☕</p>
        <h1 className="mt-2 text-2xl font-black">Set up your outlet</h1>
        <p className="mt-1 text-sm text-stone-400">One-time, 60 seconds. Menu, tables & QRs are created for you.</p>
        <a
          href="/api/auth/google?mode=setup"
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white py-3 text-sm font-black text-stone-900 transition hover:brightness-95 active:scale-[.99]"
        >
          <span className="grid size-5 place-items-center rounded-full bg-white font-black text-stone-900 ring-1 ring-stone-300">G</span>
          Sign up with Google
        </a>
        <div className="my-4 flex items-center gap-3 text-[11px] font-bold text-stone-500">
          <span className="h-px flex-1 bg-white/10" /> or fill manually <span className="h-px flex-1 bg-white/10" />
        </div>
        {paidFirst && (
          <p className="mt-3 rounded-2xl bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200">
            ✓ Payment received — finish setup and your outlet goes live.
          </p>
        )}
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input value={form.cafeName} onChange={set("cafeName")} required placeholder="Outlet name (e.g. Brew Haven)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          <input value={form.name} onChange={set("name")} required placeholder="Your name (owner)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          <input value={form.email} onChange={set("email")} type="email" required placeholder="owner@business.com (your login)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          <input value={form.password} onChange={set("password")} type="password" required minLength={8} placeholder="Password (min 8 chars)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          <input value={form.upiId} onChange={set("upiId")} placeholder="UPI ID for payments (optional)" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          {err && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
          <button disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 py-3 font-black disabled:opacity-60">
            {loading ? "Opening your outlet… 🎉" : "Open my outlet →"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-400">Already set up? <Link href="/login" className="font-bold text-orange-400">Log in</Link></p>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return <Suspense><SetupInner /></Suspense>;
}
