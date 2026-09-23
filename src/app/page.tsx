import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCafe } from "@/lib/cafe";
import { themeFromCafe } from "@/lib/theme";
import { ThemeStyles } from "@/components/theme";

// Landing page — not the menu.
// - Owner with a valid session goes straight to their cafe dashboard.
// - Everyone else gets the brand hero with Menu / Owner login CTAs.
// - QR scans keep going directly to /t/[code] (menu for that table).
export default async function Landing() {
  const s = await getSession();
  if (s) redirect("/dashboard");

  const cafe = await getCafe();
  if (!cafe) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-20 text-center">
        <p className="text-5xl">😕</p>
        <p className="mt-3 text-xl font-black">Cafe not available yet</p>
        <Link href="/setup" className="t-grad mt-5 rounded-2xl px-6 py-3 text-sm font-black text-white">
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

  return (
    <ThemeStyles theme={theme}>
      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        <div className="t-grad pointer-events-none absolute -top-24 left-1/2 h-72 w-[135%] -translate-x-1/2 rounded-[100%] opacity-30 blur-2xl" />
        <div className="relative flex flex-1 flex-col items-center px-6 pb-10 pt-16 text-center">
          <span className="t-grad grid size-20 place-items-center rounded-[28px] text-5xl shadow-2xl ring-1 ring-white/20">
            {cafe.logoEmoji || "☕"}
          </span>
          <h1 className="t-heading mt-5 text-4xl font-black leading-tight tracking-tight">{cafe.name}</h1>
          <p className="t-accent-text mt-1.5 text-sm font-bold">{cafe.tagline || "Scan. Order. Sip. Repeat."}</p>
          {cafe.description ? <p className="t-muted mt-3 max-w-sm text-sm leading-relaxed">{cafe.description}</p> : null}

          <div className="mt-8 grid w-full max-w-sm gap-2.5">
            <Link
              href="/menu"
              className="t-grad rounded-2xl py-4 text-center font-black text-white shadow-xl transition hover:brightness-110 active:scale-[.99]"
            >
              📖 View Menu →
            </Link>
            <Link
              href="/login"
              className="glass t-card rounded-2xl border border-white/10 py-3.5 text-center text-sm font-black transition hover:bg-white/10"
            >
              Owner login →
            </Link>
          </div>

          <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2 text-center">
            {[
              ["📷", "Scan QR"],
              ["🛒", "Order"],
              ["💳", "Pay"],
            ].map(([e, l]) => (
              <div key={l} className="glass t-card rounded-2xl p-3">
                <p className="text-xl">{e}</p>
                <p className="mt-1 text-[11px] font-black">{l}</p>
              </div>
            ))}
          </div>
          <p className="t-muted mt-6 text-[11px] font-bold">Dine-in only • No app needed • Works on any phone camera</p>
        </div>
        <footer className="flex items-center justify-between px-6 pb-8 text-[11px] text-stone-500">
          <span>Powered by Qtable</span>
          <Link href="/login" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold text-stone-400 transition hover:bg-white/10 hover:text-stone-200">
            Owner login →
          </Link>
        </footer>
      </div>
    </ThemeStyles>
  );
}
