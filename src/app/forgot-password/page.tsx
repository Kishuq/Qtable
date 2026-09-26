"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Request failed");
      setDone(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="glass rounded-3xl p-8">
        <p className="text-3xl">🔑</p>
        <h1 className="mt-2 text-2xl font-black">Reset password</h1>
        <p className="mt-1 text-sm text-stone-400">
          Enter your login email. If an account exists, a 24-hour reset token is created — the owner can read it
          from the database (<code>users.resetToken</code>) until email delivery is configured.
        </p>
        {done ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-200">
              If that email exists, a reset token was created (valid 24h).
            </p>
            <Link href="/reset-password" className="block w-full rounded-2xl bg-orange-600 py-3 text-center font-bold hover:bg-orange-500">
              Continue to reset →
            </Link>
            <Link href="/login" className="block text-center text-sm font-bold text-orange-400">← Back to login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="owner@business.com"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-500"
            />
            {err && <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
            <button disabled={loading} className="w-full rounded-2xl bg-orange-600 py-3 font-bold hover:bg-orange-500 disabled:opacity-60">
              {loading ? "Sending…" : "Send reset link →"}
            </button>
            <Link href="/login" className="block text-center text-sm font-bold text-orange-400">← Back to login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
