"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

// Locks Pro-only dashboard modules (inventory, insights, coupons, staff).
// Unpaid outlets are told to subscribe; paid lower tiers are told to upgrade.
export function PlanGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ plan: string; active: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((j) => setState({ plan: j?.plan || "pro", active: j?.active !== false }))
      .catch(() => setState({ plan: "pro", active: true }));
  }, []);

  // Loading or full access — render the module.
  if (state === null || (state.plan === "pro" && state.active)) return <>{children}</>;

  const unpaid = !state.active;
  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <p className="mx-auto grid size-16 place-items-center rounded-3xl bg-orange-600/15 text-3xl">🔒</p>
      <h1 className="mt-4 text-2xl font-black">{unpaid ? "Subscribe to unlock" : "Pro feature"}</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-400">
        {unpaid ? (
          <>This outlet is in preview mode. Choose a plan to unlock every module — inventory, insights, offers and staff.</>
        ) : (
          <>This module unlocks on the <b className="text-orange-300">Pro</b> plan — inventory, insights, offers and staff logins.</>
        )}
      </p>
      <Link
        href={unpaid ? "/subscribe" : "/subscribe?plan=pro&billing=monthly&next=/dashboard"}
        className="mt-5 inline-block rounded-2xl bg-orange-600 px-6 py-3 text-sm font-black transition hover:bg-orange-500 active:scale-95"
      >
        {unpaid ? "Choose a plan →" : "Upgrade to Pro →"}
      </Link>
    </div>
  );
}
