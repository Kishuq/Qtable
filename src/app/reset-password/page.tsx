"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState(sp.get("email") || "");
  const [token, setToken] = useState(sp.get("token") || "");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw1 !== pw2) {
      setErr("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: token.trim(), newPassword: pw1 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Reset failed");
      router.push("/login");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="glass rounded-3xl p-8">
        <p className="text-3xl">🔑</p>
        <h1 className="mt-2 text-2xl font-black">Set a new password</h1>
        <p className="mt-1 text-sm text-stone-400">Paste the reset token for your email (valid 24h).</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="owner@business.com"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500"
          />
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            minLength={32}
            placeholder="Reset token"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500"
          />
          <input
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            type="password"
            required
            minLength={8}
            placeholder="New password (8+ chars)"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500"
          />
          <input
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            type="password"
            required
            minLength={8}
            placeholder="Confirm new password"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500"
          />
          {err && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
          <button disabled={loading} className="w-full rounded-2xl bg-orange-600 py-3 font-bold hover:bg-orange-500 disabled:opacity-60">
            {loading ? "Resetting…" : "Reset password →"}
          </button>
          <Link href="/login" className="block text-center text-sm font-bold text-orange-400">← Back to login</Link>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
