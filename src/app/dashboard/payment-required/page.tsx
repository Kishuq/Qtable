import { useSearchParams, usePathname } from "next/navigation";
import { z } from "zod";

export default function PaymentRequired() {
  const searchParams = useSearchParams();
  const redirectFrom = searchParams.get("redirectFrom") || "/dashboard";
  const status = searchParams.get("status") || "";

  // Map Stripe status to user-friendly messages
  const statusMessages: Record<string, string> = {
    past_due: "Your subscription payment failed. Please update your card.",
    canceled: "Your subscription has been canceled. Reactivate to continue.",
    unpaid: "Your account is past due. Please pay to continue service.",
    trial_will_expire: "Your trial is ending soon. Please subscribe to continue.",
    unknown: "Your subscription needs attention. Please update payment method.",
  };

  const message = statusMessages[status as keyof typeof statusMessages] ||
    "Your subscription requires attention. Please update your payment method to continue using QRServe.";

  return (
    <div className="min-h-screen bg-gray-50 p-8 max-w-md mx-auto">
      <div className="bg-white rounded-xl p-8 shadow-lg max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path className="stroke-width-2" d="M12 9v2m0 4v2m-6-3h12m-6 3h12m0 0h12m-6-3H6m6 3H18"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">💳 Payment Required</h2>
          <p className="text-gray-600 mt-2">{message}</p>
        </div>

        <div className="space-y-4">
          {/* Stripe Checkout Button (if STRIPE keys are configured) */}
          {process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
            <button
              id="stripe-checkout-btn"
              className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700"
              disabled>
              ⚠️ Please configure Stripe keys in Vercel dashboard to enable payment recovery
            </button>
          )}

          <button
            onClick={() => {
              // Redirect to Stripe Customer Portal if keys are configured
              if (process.env.STRIPE_SECRET_KEY && process.env.BILLING_SUBSCRIPTION_ID) {
                const base = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app";
                const protocol = base.startsWith("https:") ? "https" : "http";
                const host = base.replace(/^https?:\/\//, "");
                const portalUrl = `${protocol}://${host}/dashboard/settings`;
                window.open(portalUrl, "_blank");
              }
            }}
            className="w-full bg-gray-200 text-gray-800 py-3 rounded-md hover:bg-gray-300"
          >
            Go to Billing Portal
          </button>

          <button
            onClick={() => window.location.href = redirectFrom}
            className="w-full bg-gray-200 text-gray-800 py-3 rounded-md hover:bg-gray-300"
          >
            ← Return to Dashboard
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Your subscription requires attention to continue using QRServe.</p>
        </div>
      </div>
    </div>
  );
}