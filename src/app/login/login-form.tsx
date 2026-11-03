"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm({ defaultEmail = "", googleEnabled = false }: { defaultEmail?: string; googleEnabled?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(sp.get("error") || "");
  const [useGoogle, setUseGoogle] = useState(false);
  const [loading, setLoading] = useState(false);
  const next = sp.get("next") || "/dashboard";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setUseGoogle(false); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = await r.json();
      if (!r.ok) {
        // 402 = subscription gate — forward to /subscribe, then back here.
        if (r.status === 402 && j.redirect) {
          router.push(`${j.redirect}?next=${encodeURIComponent(next)}`);
          router.refresh();
          return;
        }
        if (j.useGoogle) setUseGoogle(true);
        throw new Error(j.error || "Login failed");
      }
      router.push(next);
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
        <p className="mt-1 text-sm text-stone-400">Orders, menu, payments & analytics — one login, 30 days.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block text-left">
            <span className="mb-1 block text-xs font-bold text-stone-400">Email address</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@youroutlet.com" autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
            {defaultEmail && email === defaultEmail && (
              <span className="mt-1 block text-[11px] text-stone-500">Remembered from your last login — just add your password.</span>
            )}
          </label>
          <label className="block text-left">
            <span className="mb-1 flex items-center justify-between text-xs font-bold text-stone-400">
              Password
              <Link href="/forgot-password" className="font-bold text-orange-400">Forgot?</Link>
            </span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder="••••••••" autoComplete="current-password"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          </label>
          {err && (
            <p className={`rounded-2xl p-3 text-sm ${useGoogle ? "bg-amber-500/10 text-amber-200" : "bg-red-500/10 text-red-300"}`}>
              {err}
            </p>
          )}
          <button disabled={loading} className="w-full rounded-2xl bg-orange-600 py-3.5 font-black transition hover:bg-orange-500 active:scale-[.99] disabled:opacity-60">
            {loading ? "Logging in…" : "Log in →"}
          </button>
        </form>
        {googleEnabled && (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] font-bold text-stone-500">
              <span className="h-px flex-1 bg-white/10" /> OR <span className="h-px flex-1 bg-white/10" />
            </div>
            <a
              href={`/api/auth/google?mode=login&next=${encodeURIComponent(next)}`}
              className={`flex w-full items-center justify-center gap-2.5 rounded-2xl border py-3.5 text-sm font-black transition active:scale-[.99] ${
                useGoogle
                  ? "border-orange-400/60 bg-white text-stone-900 ring-2 ring-orange-400/40 hover:brightness-95"
                  : "border-white/15 bg-white text-stone-900 hover:brightness-95"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-white font-black text-stone-900 ring-1 ring-stone-300">G</span>
              Continue with Google — no password
            </a>
          </>
        )}
        <p className="mt-4 text-center text-xs text-stone-500">🔒 Encrypted session • 30-day stay-signed-in</p>
        <p className="mt-3 border-t border-white/10 pt-4 text-center text-sm text-stone-400">New outlet? <Link href="/subscribe?next=/setup" className="text-orange-400 font-bold">See plans & get started</Link></p>
      </div>
    </div>
  );
}

export function LoginFormShell({ defaultEmail = "", googleEnabled = false }: { defaultEmail?: string; googleEnabled?: boolean }) {
  return <Suspense><LoginForm defaultEmail={defaultEmail} googleEnabled={googleEnabled} /></Suspense>;
}
