"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("owner@mycafe.com");
  const [password, setPassword] = useState("demo1234");
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
      if (!r.ok) throw new Error(j.error || "Login failed");
      router.push(sp.get("next") || "/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="glass rounded-3xl p-8">
        <p className="text-3xl">☕</p>
        <h1 className="mt-2 text-2xl font-black">Owner login</h1>
        <p className="mt-1 text-sm text-stone-400">Counter, mobile &amp; kitchen — one login.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="owner@cafe.com"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder="Password"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500" />
          {err && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
          <button disabled={loading} className="w-full rounded-2xl bg-orange-600 py-3 font-bold hover:bg-orange-500 disabled:opacity-60">
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-stone-400">First run? <Link href="/setup" className="text-orange-400 font-bold">Set up your cafe</Link></p>
        <p className="mt-2 text-center text-sm"><Link href="/forgot-password" className="font-bold text-orange-400">Forgot password?</Link></p>
        <p className="mt-3 rounded-2xl bg-white/5 p-3 text-xs text-stone-400">Demo: owner@mycafe.com / demo1234</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
