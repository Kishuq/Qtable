import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCafe } from "@/lib/cafe";
import { db } from "@/lib/db";
import { themeFromCafe } from "@/lib/theme";
import { ThemeStyles } from "@/components/theme";
import { inr } from "@/lib/format";

// Landing page — brand experience, not the menu.
// - Owner with a valid session goes straight to their cafe dashboard.
// - Everyone else gets an animated hero with Menu / Owner login CTAs.
// - QR scans keep going directly to /t/[code] (menu for that table).
export default async function Landing() {
  const s = await getSession();
  if (s) redirect("/dashboard");

  const cafe = await getCafe();
  if (!cafe) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        <p className="animate-floaty text-6xl">☕</p>
        <p className="anim-rise mt-4 text-2xl font-black" style={{ animationDelay: ".1s" }}>
          Cafe not available yet
        </p>
        <p className="anim-rise mt-2 text-sm text-stone-400" style={{ animationDelay: ".2s" }}>
          First run? Create your cafe in under a minute.
        </p>
        <Link
          href="/setup"
          className="t-grad anim-rise mt-6 rounded-2xl px-7 py-3.5 text-sm font-black text-white shadow-xl transition hover:brightness-110 active:scale-95"
          style={{ animationDelay: ".3s" }}
        >
          Set up your cafe →
        </Link>
      </div>
    );
  }

  const theme = themeFromCafe({
    primary: cafe.themePrimary,
    accent: cafe.themeAccent,
    bg: cafe.themeBg,
    bgMode: cafe.themeBgMode,
    pattern: cafe.themePattern,
    font: cafe.themeFont,
    radius: cafe.themeRadius,
  });

  const [itemCount, tableCount, stars] = await Promise.all([
    db.menuItem.count({ where: { cafeId: cafe.id, available: true } }),
    db.cafeTable.count({ where: { cafeId: cafe.id, active: true } }),
    db.menuItem.findMany({
      where: { cafeId: cafe.id, available: true, popular: true },
      select: { name: true, price: true, imageEmoji: true },
      orderBy: { sort: "asc" },
      take: 6,
    }),
  ]);

  const marquee = stars.length > 0 ? stars.map((f) => f.name) : ["Fresh", "Fast", "Tasty"];
  const marqueeRow = [...marquee, ...marquee];

  return (
    <ThemeStyles theme={theme}>
      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        {/* Ambient animated glows */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden">
          <div className="t-grad animate-drift absolute -top-24 left-1/2 h-72 w-[135%] -translate-x-1/2 rounded-[100%] opacity-30 blur-2xl" />
          <div className="animate-drift-2 absolute -left-16 top-40 size-44 rounded-full bg-white/5 blur-2xl" />
          <div className="animate-drift absolute -right-16 top-64 size-52 rounded-full bg-white/5 blur-2xl" />
        </div>

        {/* Hero */}
        <div className="relative flex flex-col items-center px-6 pb-6 pt-14 text-center">
          <span
            className="anim-rise t-grad grid size-20 place-items-center rounded-[28px] text-5xl shadow-2xl ring-1 ring-white/20"
            style={{ animationDelay: ".05s" }}
          >
            {cafe.logoEmoji || "☕"}
          </span>
          <p
            className="anim-rise mt-4 flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-black text-emerald-300"
            style={{ animationDelay: ".12s" }}
          >
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Open now • Dine-in
          </p>
          <h1
            className="t-heading anim-rise mt-3 text-5xl font-black leading-[1.05] tracking-tight"
            style={{ animationDelay: ".18s" }}
          >
            {cafe.name}
          </h1>
          <p className="t-accent-text anim-rise mt-2 text-sm font-bold" style={{ animationDelay: ".24s" }}>
            {cafe.tagline || "Scan. Order. Sip. Repeat."}
          </p>
          {cafe.description ? (
            <p className="t-muted anim-rise mt-3 max-w-sm text-sm leading-relaxed" style={{ animationDelay: ".3s" }}>
              {cafe.description}
            </p>
          ) : null}

          <div className="anim-rise mt-4 flex items-center gap-2" style={{ animationDelay: ".34s" }}>
            {[
              `${itemCount} dishes`,
              `${tableCount} tables`,
              `${cafe.currency || "INR"}`,
            ].map((chip) => (
              <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-stone-300">
                {chip}
              </span>
            ))}
          </div>

          <div className="anim-rise mt-7 grid w-full max-w-sm gap-2.5" style={{ animationDelay: ".4s" }}>
            <Link
              href="/menu"
              className="t-grad group rounded-2xl py-4 text-center font-black text-white shadow-xl transition hover:brightness-110 active:scale-[.99]"
            >
              📖 View Menu
              <span className="ml-1 inline-block transition group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/login"
              className="glass t-card rounded-2xl border border-white/10 py-3.5 text-center text-sm font-black transition hover:bg-white/10 active:scale-[.99]"
            >
              Owner login →
            </Link>
          </div>
        </div>

        {/* Marquee */}
        <div className="relative overflow-hidden border-y border-white/10 bg-white/[.03] py-2.5">
          <div className="animate-marquee flex w-max items-center gap-6 whitespace-nowrap text-xs font-black uppercase tracking-[0.2em] text-stone-300">
            {marqueeRow.map((m, i) => (
              <span key={`${m}-${i}`} className="flex items-center gap-6">
                <span>{m}</span>
                <span className="t-accent-text">✦</span>
              </span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="px-5 pt-7">
          <p className="t-heading text-sm font-black">How it works</p>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {[
              ["📷", "1. Scan", "QR on your table"],
              ["🛒", "2. Order", "Menu in seconds"],
              ["💳", "3. Pay", "Cash, UPI, card"],
            ].map(([e, t, d], i) => (
              <div
                key={t}
                className="glass t-card card-hover anim-rise rounded-3xl p-4 text-center"
                style={{ animationDelay: `${0.45 + i * 0.08}s` }}
              >
                <p className="animate-floaty text-2xl" style={{ animationDelay: `${i * 0.7}s` }}>
                  {e}
                </p>
                <p className="mt-1.5 text-xs font-black">{t}</p>
                <p className="t-muted mt-0.5 text-[11px]">{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Star dishes */}
        {stars.length > 0 && (
          <div className="pt-7">
            <div className="flex items-center justify-between px-5">
              <p className="t-heading text-sm font-black">⭐ House favourites</p>
              <Link href="/menu" className="t-accent-text text-xs font-black">
                Full menu →
              </Link>
            </div>
            <div className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto px-5">
              {stars.map((f, i) => (
                <Link
                  key={`${f.name}-${i}`}
                  href="/menu"
                  className="glass t-card card-hover anim-rise w-40 shrink-0 snap-start overflow-hidden p-3 text-left"
                  style={{ animationDelay: `${0.5 + i * 0.06}s` }}
                >
                  <p className="text-3xl">{f.imageEmoji}</p>
                  <p className="mt-2 truncate text-xs font-black">{f.name}</p>
                  <p className="t-primary-text mt-0.5 text-xs font-black">{inr(f.price, cafe.currency || "INR")}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA band */}
        <div className="px-5 pt-7">
          <div className="t-grad anim-rise relative overflow-hidden rounded-3xl p-6 text-center text-white shadow-2xl" style={{ animationDelay: ".55s" }}>
            <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 size-44 rounded-full bg-black/20 blur-2xl" />
            <p className="relative text-lg font-black">Hungry already?</p>
            <p className="relative mt-1 text-xs font-bold opacity-85">No app needed • Works on any phone camera</p>
            <Link
              href="/menu"
              className="relative mt-4 inline-block rounded-2xl bg-white/95 px-7 py-3 text-sm font-black text-stone-900 shadow-lg transition hover:scale-[1.02] active:scale-95"
            >
              Start ordering →
            </Link>
          </div>
        </div>

        <footer className="flex items-center justify-between px-6 pb-8 pt-8 text-[11px] text-stone-500">
          <span>Powered by Qtable</span>
          <Link
            href="/login"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold text-stone-400 transition hover:bg-white/10 hover:text-stone-200"
          >
            Owner login →
          </Link>
        </footer>
      </div>
    </ThemeStyles>
  );
}
