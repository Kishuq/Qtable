"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentRequiredInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectFrom = searchParams.get("redirectFrom") || "/dashboard";
  const status = searchParams.get("status") || "";
  const [checking, setChecking] = useState(false);

  // Auto-redirect to the cafe dashboard once the subscription is paid.
  // Polls billing status (Stripe webhook/portal updates it) and bounces
  // back to where the owner was headed the moment it turns active.
  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        setChecking(true);
        const r = await fetch("/api/billing/status", { cache: "no-store" });
        const j = await r.json().catch(() => null);
        const b = j?.billing;
        if (!stop && b && (b.mode === "none" || b.status === "active" || b.status === "trialing")) {
          router.push(redirectFrom);
          router.refresh();
        }
      } catch {
        // offline — retry on next tick
      } finally {
        if (!stop) setChecking(false);
      }
    }
    check();
    const t = setInterval(check, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [router, redirectFrom]);

  const statusMessages: Record<string, string> = {
    past_due: "Your subscription payment failed. Please update your card.",
    canceled: "Your subscription has been canceled. Reactivate to continue.",
    unpaid: "Your account is past due. Please pay to continue service.",
    trial_will_expire: "Your trial is ending soon. Please subscribe to continue.",
    unknown: "Your subscription needs attention. Please update payment method.",
  };

  const message =
    statusMessages[status] ||
    "Your subscription requires attention. Please update your payment method to continue using QAFE.";

  return (
    <div className="min-h-screen bg-gray-50 p-8 max-w-md mx-auto">
      <div className="bg-white rounded-xl p-8 shadow-lg max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Payment Required</h2>
          <p className="text-gray-600 mt-2">{message}</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => {
              window.open("/dashboard/settings", "_blank");
            }}
            className="w-full bg-gray-200 text-gray-800 py-3 rounded-md hover:bg-gray-300"
          >
            Go to Billing Portal
          </button>

          <button
            onClick={() => {
              window.location.href = redirectFrom;
            }}
            className="w-full bg-gray-200 text-gray-800 py-3 rounded-md hover:bg-gray-300"
          >
            Return to Dashboard
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Your subscription requires attention to continue using QAFE.</p>
          <p className="mt-2 text-xs">{checking ? "Checking payment status…" : "We check automatically — you'll jump to your dashboard once paid ✓"}</p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentRequired() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <PaymentRequiredInner />
    </Suspense>
  );
}
