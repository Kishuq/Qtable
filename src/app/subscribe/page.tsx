"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SubscribeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/login";
  const [state, setState] = useState<{ mode: string; status: string } | null>(null);
  const [err, setErr] = useState("");

  // Auto-forward the moment the subscription is paid:
  // open access (no billing configured) or active/trialing → next step.
  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        const r = await fetch("/api/billing/status", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        const b = j?.billing;
        if (!b) return;
        if (!stop) setState({ mode: b.mode, status: b.status });
        if (!stop && (b.mode === "none" || b.status === "active" || b.status === "trialing")) {
          router.push(next);
          router.refresh();
        }
      } catch {
        if (!stop) setErr("Could not reach billing — check connection and retry.");
      }
    }
    check();
    const t = setInterval(check, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [router, next]);

  const blocked = state !== null && !(state.mode === "none" || state.status === "active" || state.status === "trialing");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-14">
      <div className="glass rounded-3xl p-8 text-center">
        <p className="mx-auto grid size-16 place-items-center rounded-3xl bg-orange-600/15 text-3xl">💳</p>
        <h1 className="mt-4 text-2xl font-black">Subscribe to QAFE</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-400">
          Login, setup and ordering unlock <b className="text-stone-200">after</b> an active subscription.
          Complete payment and this page forwards you automatically — no refresh needed.
        </p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm">
          <p className="font-black">
            Status:{" "}
            <span className="text-orange-400">
              {!state ? "checking…" : state.mode === "none" ? "open (no billing configured)" : state.status.replace("_", " ")}
            </span>
          </p>
          <p className="mt-1 text-xs text-stone-400">
            Starter ₹999/mo • Pro ₹1,999/mo. Pay via the billing portal link shared by QAFE support.
          </p>
        </div>

        {err && <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

        <div className="mt-5 grid gap-2">
          <Link
            href="/#pricing"
            className="w-full rounded-2xl bg-orange-600 py-3 text-center font-bold hover:bg-orange-500"
          >
            View plans →
          </Link>
          {blocked ? (
            <p className="rounded-2xl bg-amber-500/10 p-3 text-xs font-bold text-amber-200">
              ⏳ Waiting for payment… you&apos;ll move forward automatically once it&apos;s active.
            </p>
          ) : (
            <p className="rounded-2xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">
              ✓ Subscription active — forwarding…
            </p>
          )}
          <Link href="/" className="text-center text-sm font-bold text-orange-400">
            ← Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense>
      <SubscribeInner />
    </Suspense>
  );
}
