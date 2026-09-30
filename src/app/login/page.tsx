"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = await r.json();
      if (!r.ok) {
        // 402 = subscription gate — forward to /subscribe, then back here.
        if (r.status === 402 && j.redirect) {
          router.push(`${j.redirect}?next=${encodeURIComponent(sp.get("next") || "/dashboard")}`);
          router.refresh();
          return;
        }
        throw new Error(j.error || "Login failed");
      }
      router.push(sp.get("next") || "/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="glass rounded-3xl p-8">
        <p className="flex items-center gap-2 text-lg font-black text-white">
          <span className="grid size-8 place-items-center rounded-xl bg-orange-600 text-base">Q</span> Qtable
        </p>
        <h1 className="mt-3 text-2xl font-black">Log in to your outlet</h1>
        <p className="mt-1 text-sm text-stone-400">Orders, kitchen, menu & analytics — one login.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block text-left">
            <span className="mb-1 block text-xs font-bold text-stone-400">Email address</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@youroutlet.com" autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          </label>
          <label className="block text-left">
            <span className="mb-1 flex items-center justify-between text-xs font-bold text-stone-400">
              Password
              <Link href="/forgot-password" className="font-bold text-orange-400">Forgot?</Link>
            </span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder="••••••••" autoComplete="current-password"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          </label>
          {err && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
          <button disabled={loading} className="w-full rounded-2xl bg-orange-600 py-3.5 font-black transition hover:bg-orange-500 active:scale-[.99] disabled:opacity-60">
            {loading ? "Logging in…" : "Log in →"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-stone-500">🔒 Protected by encrypted sessions • 30-day stay-signed-in</p>
        <p className="mt-3 border-t border-white/10 pt-4 text-center text-sm text-stone-400">New outlet? <Link href="/subscribe?next=/setup" className="text-orange-400 font-bold">See plans & get started</Link></p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
