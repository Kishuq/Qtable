// Single source of truth for subscription plans (client-safe, no secrets).
// Prices in INR. Yearly = ~20% off, billed upfront like Hostinger terms.
export type PlanId = "menu" | "standard" | "pro";
export type Billing = "monthly" | "yearly";

export const PLANS: Record<
  PlanId,
  { name: string; blurb: string; monthly: number; mrp: number; yearlyTotal: number; features: string[] }
> = {
  menu: {
    name: "Basic",
    blurb: "Digital menu display for a single outlet.",
    monthly: 499,
    mrp: 649,
    yearlyTotal: 4990,
    features: ["Digital menu display", "Design studio + themes", "Tables & QR cards", "No ordering or payments"],
  },
  standard: {
    name: "Standard",
    blurb: "Ordering + payments for a busy outlet.",
    monthly: 699,
    mrp: 899,
    yearlyTotal: 6990,
    features: ["Everything in Basic", "Table ordering + live tracking", "Cash, UPI & card payments", "Waiter calls + history"],
  },
  pro: {
    name: "Pro",
    blurb: "The full operating system.",
    monthly: 1299,
    mrp: 1699,
    yearlyTotal: 12990,
    features: ["Everything in Standard", "Kitchen display (KDS)", "Coupons & staff logins", "Priority support"],
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

// Feature comparison matrix — the exact split enforced in code
// (ordering stack gated in MenuApp + order/waiter APIs, pro modules via PlanGate).
export const COMPARE: { label: string; menu: boolean; standard: boolean; pro: boolean }[] = [
  { label: "Digital menu + themes", menu: true, standard: true, pro: true },
  { label: "Tables & QR cards", menu: true, standard: true, pro: true },
  { label: "Table ordering", menu: false, standard: true, pro: true },
  { label: "Cash, UPI & card payments", menu: false, standard: true, pro: true },
  { label: "Live order tracking + ETA", menu: false, standard: true, pro: true },
  { label: "Waiter calls", menu: false, standard: true, pro: true },
  { label: "Order history & ledger", menu: false, standard: true, pro: true },
  { label: "Kitchen display (KDS)", menu: false, standard: false, pro: true },
  { label: "Coupons & offers", menu: false, standard: false, pro: true },
  { label: "Staff logins", menu: false, standard: false, pro: true },
];
