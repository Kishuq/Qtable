"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, ReceiptText, ChefHat, UtensilsCrossed, QrCode, Settings, LogOut, BadgePercent, Users, Wallet, Palette, History, Bell, BellOff } from "lucide-react";
import { useLiveOrders } from "@/hooks/useLiveOrders";
import { useToast } from "@/components/ux";
import { inr } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ReceiptText },
  { href: "/dashboard/history", label: "History", icon: History },
  { href: "/dashboard/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/coupons", label: "Discounts", icon: BadgePercent },
  { href: "/dashboard/design", label: "Design", icon: Palette },
  { href: "/dashboard/tables", label: "Tables & QR", icon: QrCode },
  { href: "/dashboard/payments", label: "Payments", icon: Wallet },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [cafe, setCafe] = useState<{ name: string; slug: string } | null>(null);
  const [cafeId, setCafeId] = useState<string | null>(null);
  const [billing, setBilling] = useState<{ billing: { mode: string; status: string }; portalUrl: string | null } | null>(null);
  const toast = useToast();
  const { open, connected, soundOn, toggleSound, testAlarm, audioLocked } = useLiveOrders(cafeId, (o) => {
    toast(`New order #${o.tokenNo} • Table ${o.tableCode} • ${inr(o.total)}`, "info");
  });

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      const j = await r.json();
      if (!j.user) { router.push("/login"); return; }
      setCafe(j.user.cafe);
      setCafeId(j.user.cafeId);
    }).catch(() => router.push("/login"));
    fetch("/api/billing/status").then((r) => r.json()).then((j) => {
      if (!j.error) setBilling(j);
    }).catch(() => {});
    // Re-runs on every dashboard navigation: an expired mid-shift session
    // bounces to login instead of showing misleading empty screens.
  }, [router, path]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-0 px-0 md:gap-6 md:px-5 md:py-6">
      {/* Sidebar */}
      <aside className="no-print sticky top-16 hidden h-[calc(100vh-6rem)] w-60 shrink-0 flex-col rounded-3xl border border-white/10 bg-white/[.03] p-4 md:flex">
        <div className="rounded-2xl bg-orange-600/10 p-4">
          <p className="text-xs text-stone-400">CAFE</p>
          <p className="font-black">{cafe?.name || "…"}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-bold">
            <span className={`size-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
            {connected ? "LIVE" : "POLLING"} • {open} open
          </p>
          <div className="mt-2 flex gap-1.5">
            <button onClick={toggleSound} title={soundOn ? "Mute order alarm" : "Unmute order alarm"}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-black ${soundOn ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-stone-400"}`}>
              {soundOn ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />} {soundOn ? "Alarm ON" : "Muted"}
            </button>
            <button onClick={testAlarm} title="Test the alarm sound" className="rounded-xl bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-stone-300 hover:bg-white/10">Test 🔊</button>
          </div>
        </div>
        <nav className="mt-4 space-y-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold ${path === n.href ? "bg-orange-600" : "text-stone-300 hover:bg-white/5"}`}>
              <n.icon className="size-4" /> {n.label}
              {n.label === "Orders" && open > 0 && <span className="ml-auto rounded-full bg-white/20 px-2 text-xs">{open}</span>}
            </Link>
          ))}
        </nav>
        <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }} className="mt-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm text-stone-400 hover:bg-white/5">
          <LogOut className="size-4" /> Log out
        </button>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1 px-4 py-5 md:px-0 md:py-0">
        {billing?.billing?.mode === "enforced" && ["past_due", "unpaid", "canceled"].includes(billing?.billing?.status ?? "") && (
          <div className="no-print mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            <p className="font-black text-red-200">⚠️ Subscription {(billing?.billing?.status ?? "").replace("_", " ")} — customer ordering keeps working, but update payment to stay supported.</p>
            {billing.portalUrl ? <a href={billing.portalUrl} className="mt-1 inline-block font-bold text-red-300 underline">Update payment method →</a> : <p className="mt-1 text-red-300/70">Contact QRServe support to reactivate.</p>}
          </div>
        )}
        {soundOn && audioLocked && (
          <button onClick={testAlarm} className="no-print animate-pulse-ring mb-4 w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">
            🔔 Tap here once to enable the order alarm sound
          </button>
        )}
        {/* Mobile topbar */}
        <div className="no-print mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.03] p-3 md:hidden">
          <p className="font-black">☕ {cafe?.name || "Dashboard"}</p>
          <div className="flex items-center gap-2">
            <button onClick={toggleSound} className={`grid size-8 place-items-center rounded-full ${soundOn ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-stone-400"}`}>
              {soundOn ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            </button>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">{open} open</span>
          </div>
        </div>
        <nav className="no-print no-scrollbar mb-4 flex gap-2 overflow-x-auto md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${path === n.href ? "bg-orange-600" : "bg-white/5"}`}>{n.label}</Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
