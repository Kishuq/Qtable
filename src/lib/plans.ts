// Single source of truth for subscription plans (client-safe, no secrets).
// Prices in INR. Yearly = ~20% off, billed upfront like Hostinger terms.
export type PlanId = "menu" | "standard" | "pro";
export type Billing = "monthly" | "yearly";

export const PLANS: Record<
  PlanId,
  { name: string; blurb: string; monthly: number; mrp: number; yearlyTotal: number; features: string[] }
> = {
  menu: {
    name: "Menu",
    blurb: "Digital menu display for a single outlet.",
    monthly: 699,
    mrp: 849,
    yearlyTotal: 6990,
    features: ["Digital menu display", "Design studio + themes", "Tables & QR cards", "No ordering or payments"],
  },
  standard: {
    name: "Standard",
    blurb: "Ordering + payments for a busy outlet.",
    monthly: 999,
    mrp: 1249,
    yearlyTotal: 9990,
    features: ["Everything in Menu", "Table ordering + live tracking", "Cash, UPI & card payments", "Waiter calls + order history"],
  },
  pro: {
    name: "Pro",
    blurb: "The full operating system.",
    monthly: 1999,
    mrp: 2499,
    yearlyTotal: 19990,
    features: ["Everything in Standard", "Kitchen display + staff logins", "Coupons, analytics & history", "Priority support"],
  },
};

export function planQuote(plan: PlanId, billing: Billing): { perMonth: number; total: number; note: string } {
  const p = PLANS[plan];
  if (billing === "yearly") {
    return { perMonth: Math.round(p.yearlyTotal / 12), total: p.yearlyTotal, note: `₹${p.yearlyTotal.toLocaleString("en-IN")} billed yearly` };
  }
  return { perMonth: p.monthly, total: p.monthly, note: "billed monthly" };
}

export function parsePlan(v: string | null): PlanId {
  return v === "menu" || v === "standard" || v === "pro" ? v : "standard";
}

export function parseBilling(v: string | null): Billing {
  return v === "yearly" ? "yearly" : "monthly";
}
