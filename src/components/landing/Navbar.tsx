"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "#cafes", label: "For Business" },
  { href: "#pricing", label: "Pricing" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Primary"
        className={`flex w-full max-w-5xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-stone-950/70 backdrop-blur-xl transition-all duration-300 ${
          scrolled ? "px-4 py-2.5 shadow-2xl" : "px-5 py-3.5"
        }`}
      >
        <Link href="#top" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-orange-600 text-lg font-black text-white">Q</span>
          <span className="text-lg font-black tracking-tight text-white">QAFE</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[13px] font-bold text-stone-300 transition hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-xl px-4 py-2 text-[13px] font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">
            Login
          </Link>
          <Link
            href="#pricing"
            className="rounded-xl bg-orange-600 px-4 py-2 text-[13px] font-black text-white shadow-lg transition hover:bg-orange-500 active:scale-95"
          >
            Get Started
          </Link>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="grid size-9 place-items-center rounded-xl bg-white/5 text-white md:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>
      {open && (
        <div className="absolute inset-x-4 top-full mt-2 rounded-2xl border border-white/10 bg-stone-950/95 p-3 backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-2.5 text-sm font-bold text-stone-200 hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-1 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-xl bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white">
              Login
            </Link>
            <Link href="#pricing" onClick={() => setOpen(false)} className="rounded-xl bg-orange-600 px-4 py-2.5 text-center text-sm font-black text-white">
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
