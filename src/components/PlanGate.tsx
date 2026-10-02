"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

// Locks pro-only dashboard modules (kitchen, coupons, staff) behind the Pro plan.
// Menu/standard plans see an upgrade card instead of the module.
export function PlanGate({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((j) => setPlan(j?.plan || "pro"))
      .catch(() => setPlan("pro"));
  }, []);

  // Loading or full access — render the module.
  if (plan === null || plan === "pro") return <>{children}</>;

  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <p className="mx-auto grid size-16 place-items-center rounded-3xl bg-orange-600/15 text-3xl">🔒</p>
      <h1 className="mt-4 text-2xl font-black">Pro feature</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-400">
        This module (offers & team logins) unlocks on the{" "}
        <b className="text-stone-200">Pro ₹1,299/mo</b> plan. Your current plan:{" "}
        <b className="text-stone-200">{plan === "menu" ? "Basic ₹499/mo" : "Standard ₹699/mo"}</b>.
      </p>
      <Link
        href="/subscribe?next=/dashboard"
        className="mt-6 inline-block rounded-2xl bg-orange-600 px-8 py-3.5 text-sm font-black text-white shadow-xl transition hover:bg-orange-500 active:scale-95"
      >
        Upgrade to Pro →
      </Link>
      <Link href="/dashboard" className="mt-3 block text-sm font-bold text-orange-400">
        ← Back to dashboard
      </Link>
    </div>
  );
}
