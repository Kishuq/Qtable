import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Navbar } from "@/components/landing/Navbar";
import { Reveal } from "@/components/landing/Reveal";
import { HeroScene } from "@/components/landing/HeroScene";
import { ProductTabs } from "@/components/landing/ProductTabs";

// QAFE marketing landing — product story, not the cafe menu.
// Owner with a valid session goes straight to their cafe dashboard.
// Ordering always happens via table QR (/t/[code]).
export default async function Landing() {
  const s = await getSession();
  if (s) redirect("/dashboard");

  return (
    <div id="top" className="min-h-full bg-stone-950 text-stone-50 antialiased">
      <Navbar />

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden px-5 pb-14 pt-32 md:pt-40">
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-drift absolute -top-32 left-1/2 h-96 w-[120%] -translate-x-1/2 rounded-[100%] bg-orange-700/15 blur-3xl" />
          <div className="animate-drift-2 absolute right-[-80px] top-64 size-72 rounded-full bg-amber-500/[.07] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="anim-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-stone-300">
            <span className="size-1.5 animate-pulse rounded-full bg-orange-400" /> QAFE — Cafe Operating System
          </p>
          <h1 className="anim-rise qafe-serif mt-5 text-5xl font-black leading-[1.02] md:text-7xl" style={{ animationDelay: ".1s" }}>
            Your cafe, flowing
            <br />
            at a whole <span className="text-orange-500">new speed.</span>
          </h1>
          <p className="anim-rise mx-auto mt-5 max-w-2xl text-base leading-relaxed text-stone-400 md:text-lg" style={{ animationDelay: ".2s" }}>
            Turn every table into a smarter ordering experience. QAFE connects your menu, customers, kitchen,
            tables and operations in one seamless platform.
          </p>
          <div className="anim-rise mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row" style={{ animationDelay: ".3s" }}>
            <Link
              href="/subscribe?next=/setup"
              className="w-full rounded-2xl bg-orange-600 px-8 py-4 text-sm font-black text-white shadow-2xl shadow-orange-900/40 transition hover:bg-orange-500 active:scale-[.98] sm:w-auto"
            >
              Start Your Cafe →
            </Link>
            <Link
              href="#how"
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-black text-white transition hover:bg-white/10 active:scale-[.98] sm:w-auto"
            >
              See How It Works
            </Link>
          </div>
          <p className="anim-rise mt-4 text-xs font-bold text-stone-500" style={{ animationDelay: ".38s" }}>
            No app download. No complicated setup. Just scan and order.
          </p>
        </div>
        <div className="anim-rise relative mx-auto mt-12 max-w-4xl" style={{ animationDelay: ".45s" }}>
          <HeroScene />
        </div>
      </section>

      {/* ---------- PRINCIPLES ---------- */}
      <section className="border-y border-white/10 bg-white/[.02] px-5 py-10">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-stone-500">Built for the way modern cafes work</p>
          </Reveal>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["⚡", "Fast", "Orders in seconds, not minutes."],
              ["✦", "Simple", "Staff learn it in one shift."],
              ["🔗", "Connected", "Menu to kitchen, live."],
              ["🔒", "Secure", "Protected APIs & audit logs."],
            ].map(([e, t, d], i) => (
              <Reveal key={t} delay={i * 80}>
                <div className="rounded-3xl border border-white/10 bg-stone-900/60 p-5 text-left transition hover:border-orange-500/40">
                  <p className="text-2xl">{e}</p>
                  <p className="mt-2 font-black text-white">{t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-400">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- OLD WAY → QAFE ---------- */}
      <section className="bg-[#171008] px-5 py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="qafe-serif text-center text-4xl font-black leading-tight md:text-5xl">
              Running a cafe shouldn&apos;t feel chaotic.
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
            {[
              "Customers waiting, waving for staff",
              "Greasy paper menus, reprinted weekly",
              "Missed orders on noisy counters",
              "Kitchen shouting across the pass",
              "Table tracking on memory & paper",
              "Inventory surprises mid-rush",
            ].map((t, i) => (
              <Reveal key={t} delay={i * 60}>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-stone-300">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-300">✕</span>
                  {t}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="mt-10 rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-600/15 to-transparent p-8 text-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-400">The shift</p>
              <div className="mx-auto mt-4 grid max-w-2xl gap-2 text-left text-sm font-bold sm:grid-cols-2">
                {[
                  ["Paper menu", "→ Digital Menu"],
                  ["Waiting customer", "→ Instant Ordering"],
                  ["Kitchen confusion", "→ Live Kitchen Queue"],
                  ["Manual tracking", "→ Smart Dashboard"],
                ].map(([a, b]) => (
                  <p key={a} className="rounded-xl bg-black/30 p-3 text-stone-300">
                    <span className="line-through opacity-60">{a}</span> <span className="text-emerald-300">{b}</span>
                  </p>
                ))}
              </div>
              <p className="qafe-serif mt-6 text-4xl font-black text-white md:text-5xl">
                Meet <span className="text-orange-500">QAFE.</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="scroll-mt-24 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">How it works</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black md:text-5xl">From scan to served.</h2>
          </Reveal>
          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {[
              ["01", "Scan", "Customer scans the table QR."],
              ["02", "Explore", "Beautiful menu opens instantly."],
              ["03", "Order", "Customize & place the order."],
              ["04", "Prepare", "Kitchen gets it in seconds."],
              ["05", "Serve", "Live tracking till ready."],
            ].map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 80}>
                <div className="relative h-full rounded-3xl border border-white/10 bg-white/[.03] p-5">
                  <p className="font-mono text-xs font-black text-orange-500">{n}</p>
                  <p className="mt-1.5 font-black text-white">{t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-400">{d}</p>
                  {i < 4 && <span className="absolute -right-2 top-1/2 hidden text-orange-500 md:block">→</span>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PRODUCT ---------- */}
      <section id="product" className="scroll-mt-24 border-y border-white/10 bg-white/[.02] px-5 py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Product tour</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black md:text-5xl">One platform, every screen.</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Real interface patterns from the actual product — switch tabs to walk the whole operation.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 rounded-[28px] border border-white/10 bg-stone-950/60 p-5 md:p-8">
              <ProductTabs />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- CUSTOMER ---------- */}
      <section className="px-5 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">For customers</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black leading-tight">No app. No waiting. No friction.</h2>
            <ul className="mt-5 space-y-2.5 text-sm text-stone-300">
              {["Categories & food photography", "Product cards with customization", "Cart & one-tap checkout", "Live order status till served"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs text-emerald-300">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto w-full max-w-[280px] rounded-[36px] border border-white/15 bg-stone-900 p-3 shadow-2xl">
              <div className="rounded-[26px] bg-stone-950 p-4">
                <p className="text-center text-sm font-black text-white">☕ Brew Haven</p>
                <p className="text-center text-[10px] font-bold text-orange-400">Table 12 • Dine-in</p>
                <div className="mt-3 space-y-2">
                  {[
                    ["Signature Cappuccino", "₹180", "☕"],
                    ["Peri-Peri Fries", "₹129", "🍟"],
                  ].map(([n, p, e]) => (
                    <div key={n} className="flex items-center gap-2.5 rounded-2xl bg-white/5 p-2.5">
                      <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-lg">{e}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-black text-white">{n}</p>
                        <p className="text-[11px] font-bold text-orange-400">{p}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl bg-orange-600 py-2.5 text-center text-xs font-black text-white">Place order • ₹309</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- OWNER ---------- */}
      <section id="cafes" className="scroll-mt-24 border-y border-white/10 bg-white/[.02] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">For owners</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black md:text-5xl">Everything your cafe needs. One screen.</h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["₹42,850", "Revenue today", "+18.4%"],
              ["142", "Orders", "today"],
              ["8", "Active now", "live"],
              ["₹302", "Avg order", "per ticket"],
            ].map(([v, l, s], i) => (
              <Reveal key={l} delay={i * 70}>
                <div className="rounded-3xl border border-white/10 bg-stone-950/70 p-5">
                  <p className="text-2xl font-black text-white">{v}</p>
                  <p className="mt-1 text-xs font-bold text-stone-400">{l}</p>
                  <p className="text-[11px] font-black text-emerald-300">{s}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Orders", "Kitchen", "Tables", "Inventory", "Staff", "Analytics"].map((m) => (
                <span key={m} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-stone-200">
                  {m}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- REALTIME ---------- */}
      <section className="px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="qafe-serif text-center text-4xl font-black md:text-5xl">Watch an order come alive.</h2>
          </Reveal>
          <div className="mt-10 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {[
              ["📱", "Customer", "Order #104 placed"],
              ["🖥️", "Dashboard", "New order lands"],
              ["👨‍🍳", "Kitchen", "Status → Preparing"],
              ["🔔", "Customer", "Ready — come grab it"],
            ].map(([e, t, d], i) => (
              <Reveal key={t + i} delay={i * 100} className="flex">
                <div className="flex flex-1 flex-col items-center rounded-3xl border border-white/10 bg-white/[.03] p-5 text-center">
                  <p className="text-3xl">{e}</p>
                  <p className="mt-2 text-sm font-black text-white">{t}</p>
                  <p className="mt-1 text-xs text-stone-400">{d}</p>
                </div>
                {i < 3 && (
                  <div className="hidden items-center px-1 md:flex" aria-hidden="true">
                    <svg width="28" height="12" viewBox="0 0 28 12">
                      <line x1="2" y1="6" x2="26" y2="6" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" className="flow-line" />
                    </svg>
                  </div>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- TABLES ---------- */}
      <section className="border-y border-white/10 bg-white/[.02] px-5 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Table management</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black">Your floor, at a glance.</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-stone-400">Hover any table for its live order. Green is free, amber is busy, orange is ordering.</p>
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto mt-8 grid max-w-md grid-cols-4 gap-2.5">
              {[
                ["T1", "Free", "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", "—"],
                ["T2", "Busy • ₹860", "bg-amber-500/15 text-amber-300 border-amber-500/30", "Preparing"],
                ["T3", "Ordering", "bg-orange-500/15 text-orange-300 border-orange-500/30", "In cart"],
                ["T4", "Free", "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", "—"],
                ["T5", "Busy • ₹420", "bg-amber-500/15 text-amber-300 border-amber-500/30", "Served"],
                ["T6", "Reserved", "bg-sky-500/15 text-sky-300 border-sky-500/30", "7:30 PM"],
                ["T7", "Free", "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", "—"],
                ["T8", "Ordering", "bg-orange-500/15 text-orange-300 border-orange-500/30", "Paying"],
              ].map(([t, s, c, tip]) => (
                <div key={t} className="group relative">
                  <div className={`cursor-default rounded-2xl border p-4 transition hover:scale-105 ${c}`}>
                    <p className="text-sm font-black">{t}</p>
                    <p className="mt-0.5 text-[10px] font-bold opacity-80">{s}</p>
                  </div>
                  <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-stone-900 px-3 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                    Table {t} • {tip}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- QR ---------- */}
      <section className="px-5 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">QR Platform</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black leading-tight">One QR. An entire digital experience.</h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              The QR is the portal — it carries the table, opens the menu, routes the order, and feeds analytics.
              Print once, run forever.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Menu", "Ordering", "Table", "Analytics", "Customer", "Kitchen"].map((t) => (
                <span key={t} className="rounded-full bg-white/5 px-4 py-2 text-xs font-black text-stone-200 ring-1 ring-white/10">
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={140}>
            <div className="relative mx-auto w-fit">
              <div className="absolute -inset-6 rounded-[36px] bg-orange-600/15 blur-2xl" aria-hidden="true" />
              <div className="relative rounded-[28px] border border-white/10 bg-white p-6 text-center shadow-2xl">
                <p className="text-3xl">☕</p>
                <p className="mt-1 font-black tracking-tight text-stone-900">QAFE Demo Cafe</p>
                <div className="mx-auto mt-3 grid size-44 grid-cols-5 grid-rows-5 gap-1 rounded-2xl border-4 border-stone-900 p-2">
                  {[1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1].map((v, i) => (
                    <span key={i} className={`rounded-[3px] ${v ? "bg-stone-900" : "bg-white"}`} />
                  ))}
                </div>
                <p className="mx-auto mt-3 inline-block rounded-full bg-stone-900 px-6 py-1.5 text-sm font-black tracking-widest text-white">
                  TABLE T12
                </p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Powered by QAFE</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- ANALYTICS ---------- */}
      <section className="border-y border-white/10 bg-white/[.02] px-5 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Analytics</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black leading-tight">Know what&apos;s happening. Before the rush hits.</h2>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["₹42,850", "↑ 18.4%", "Revenue"],
                ["142", "today", "Orders"],
                ["Signature Cappuccino", "top item", "Popular"],
                ["7–9 PM", "peak", "Peak time"],
              ].map(([v, s, l], i) => (
                <div key={l} className="rounded-2xl border border-white/10 bg-stone-950/70 p-4">
                  <p className="truncate text-lg font-black text-white">{v}</p>
                  <p className="text-[11px] font-black text-emerald-300">{s}</p>
                  <p className="text-[11px] text-stone-500">{l}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-500">1,842 QR scans → 624 orders from QR this month.</p>
          </Reveal>
          <Reveal delay={130}>
            <div className="rounded-3xl border border-white/10 bg-stone-950/70 p-6">
              <p className="text-xs font-black uppercase tracking-widest text-stone-400">Revenue this week</p>
              <div className="mt-4 flex h-36 items-end gap-2">
                {[
                  ["M", 38],
                  ["T", 55],
                  ["W", 47],
                  ["T", 72],
                  ["F", 92],
                  ["S", 100],
                  ["S", 63],
                ].map(([d, h]) => (
                  <div key={d as string} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-28 w-full items-end">
                      <div className="bar-fill w-full rounded-t-lg bg-gradient-to-t from-orange-700 to-orange-400" style={{ height: `${h}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-stone-500">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- INVENTORY ---------- */}
      <section className="px-5 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <Reveal>
            <div className="rounded-3xl border border-white/10 bg-white/[.03] p-6">
              {[
                ["Mushrooms", 80],
                ["Coffee Beans", 70],
                ["Milk", 35],
              ].map(([n, p]) => (
                <div key={n as string} className="mb-4 last:mb-0">
                  <div className="flex justify-between text-xs font-black">
                    <span className="text-white">{n}</span>
                    <span className="text-stone-400">{p}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`bar-fill h-full rounded-full ${Number(p) < 40 ? "bg-gradient-to-r from-red-600 to-amber-500" : "bg-gradient-to-r from-emerald-600 to-emerald-400"}`}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-bold text-amber-200">
                ⚠️ Milk inventory is running low.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Operations</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black leading-tight">Less guessing. More knowing.</h2>
            <p className="mt-4 text-sm leading-relaxed text-stone-400">
              Track stock against live sales, hide items the moment they run out, and catch shortages before the
              dinner rush — all from the same screen that runs your orders.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section id="features" className="scroll-mt-24 border-y border-white/10 bg-white/[.02] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Everything included</p>
            <h2 className="qafe-serif mt-2 max-w-xl text-4xl font-black md:text-5xl">A complete toolkit, not another menu link.</h2>
          </Reveal>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Digital Menu", "Beautiful, fast, mobile-first menus.", true],
              ["Smart Ordering", "Customers order from their table.", false],
              ["Live Kitchen", "Orders reach the kitchen instantly.", true],
              ["Table Management", "Know every table's live status.", false],
              ["Inventory", "Track stock and availability.", false],
              ["Analytics", "Revenue, rush hours, top items.", true],
              ["Staff Roles", "Owner, staff and kitchen access.", false],
              ["QR Management", "Create and print table QRs.", false],
              ["Secure Payments", "Trusted UPI, card & counter flows.", true],
            ].map(([t, d, big], i) => (
              <Reveal key={t as string} delay={(i % 3) * 70} className={big ? "sm:col-span-1 lg:row-span-1" : ""}>
                <div className="h-full rounded-3xl border border-white/10 bg-stone-950/60 p-6 transition hover:border-orange-500/40">
                  <p className="text-lg font-black text-white">{t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-400">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SECURITY ---------- */}
      <section className="px-5 py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Security</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black leading-tight">Built with security at the foundation.</h2>
            <ul className="mt-5 space-y-2.5 text-sm text-stone-300">
              {[
                "Secure authentication with hashed passwords",
                "Role-based access for owner, staff & kitchen",
                "Per-cafe data isolation on every query",
                "Encrypted HTTPS connections throughout",
                "Server-side price validation on every order",
                "Audit logging for logins, payments & changes",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-300">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={130}>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.05] to-transparent p-8 text-center">
              <p className="mx-auto grid size-16 place-items-center rounded-3xl bg-emerald-500/15 text-3xl">🛡️</p>
              <p className="mt-4 font-mono text-xs leading-loose text-stone-400">
                bcrypt-12 • httpOnly JWT • rate limits
                <br />
                Zod on every API • RBAC • CSP/HSTS
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- PRICING ---------- */}
      <section id="pricing" className="scroll-mt-24 border-t border-white/10 px-5 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Pricing</p>
            <h2 className="qafe-serif mt-2 text-4xl font-black md:text-5xl">One plan per cafe. Zero surprises.</h2>
          </Reveal>
          <div className="mt-8 grid gap-3 text-left md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl border border-white/10 bg-white/[.03] p-7">
                <p className="text-sm font-black text-stone-300">Starter</p>
                <p className="mt-2 text-4xl font-black text-white">
                  ₹999<span className="text-base font-bold text-stone-500">/mo</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-stone-300">
                  {["QR menu + table ordering", "Live orders dashboard", "UPI & counter payments", "1 outlet"].map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-emerald-300">✓</span> {t}
                    </li>
                  ))}
                </ul>
                <Link href="/subscribe?next=/setup" className="mt-6 block rounded-2xl border border-white/15 bg-white/5 py-3 text-center text-sm font-black text-white transition hover:bg-white/10">
                  Start with Starter
                </Link>
              </div>
            </Reveal>
            <Reveal delay={110}>
              <div className="relative h-full rounded-3xl border border-orange-500/50 bg-gradient-to-b from-orange-600/15 to-transparent p-7">
                <span className="absolute -top-3 left-6 rounded-full bg-orange-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                  Most popular
                </span>
                <p className="text-sm font-black text-orange-300">Pro</p>
                <p className="mt-2 text-4xl font-black text-white">
                  ₹1,999<span className="text-base font-bold text-stone-500">/mo</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-stone-200">
                  {["Everything in Starter", "Kitchen display + staff roles", "Inventory + analytics", "Online card payments"].map((t) => (
                    <li key={t} className="flex gap-2">
                      <span className="text-emerald-300">✓</span> {t}
                    </li>
                  ))}
                </ul>
                <Link href="/subscribe?next=/setup" className="mt-6 block rounded-2xl bg-orange-600 py-3 text-center text-sm font-black text-white shadow-xl transition hover:bg-orange-500">
                  Start with Pro →
                </Link>
              </div>
            </Reveal>
          </div>
          <Reveal delay={140}>
            <p className="mt-5 text-xs text-stone-500">One-time setup help available • Cancel anytime • Ordering never stops mid-service</p>
          </Reveal>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-orange-700 via-orange-600 to-amber-500 p-10 text-center text-white shadow-2xl md:p-16">
              <div className="pointer-events-none absolute -left-12 -top-12 size-56 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-16 -right-12 size-64 rounded-full bg-black/25 blur-3xl" aria-hidden="true" />
              <h2 className="qafe-serif relative text-4xl font-black md:text-6xl">Ready to make your cafe flow?</h2>
              <p className="relative mx-auto mt-4 max-w-xl text-sm font-bold opacity-90 md:text-base">
                Give your customers a faster way to order — and your team a smarter way to run the day.
              </p>
              <div className="relative mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
                <Link href="/subscribe?next=/setup" className="rounded-2xl bg-stone-950 px-8 py-4 text-sm font-black text-white transition hover:scale-[1.02] active:scale-95">
                  Start with QAFE →
                </Link>
                <Link href="/login" className="rounded-2xl border border-white/40 px-8 py-4 text-sm font-black text-white transition hover:bg-white/10 active:scale-95">
                  Book a Demo
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-white/10 px-5 pb-10 pt-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2 text-lg font-black text-white">
              <span className="grid size-8 place-items-center rounded-xl bg-orange-600 text-base">Q</span> QAFE
            </p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-stone-500">The digital operating system for modern cafes.</p>
          </div>
          {[
            ["Product", [["How it works", "#how"], ["Features", "#features"], ["Pricing", "#pricing"], ["Owner login", "/login"]]],
            ["Cafe", [["View menu", "/t/T1"], ["Track order", "/t/T1"], ["Give feedback", "/t/T1"], ["Get started", "/setup"]]],
            ["Support", [["Book a demo", "/login"], ["Setup guide", "/setup"], ["Status", "/api/health"], ["Privacy", "#top"]]],
          ].map(([h, links]) => (
            <div key={h as string}>
              <p className="text-xs font-black uppercase tracking-widest text-stone-400">{h}</p>
              <ul className="mt-3 space-y-2">
                {(links as [string, string][]).map(([l, href]) => (
                  <li key={l}>
                    <Link href={href} className="text-sm text-stone-500 transition hover:text-white">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-xs text-stone-600 md:flex-row">
          <p>© 2026 QAFE. All rights reserved.</p>
          <p>Scan. Order. Flow.</p>
        </div>
      </footer>
    </div>
  );
}
