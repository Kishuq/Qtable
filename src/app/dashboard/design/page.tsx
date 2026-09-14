"use client";
import { useEffect, useState } from "react";
import { FONTS, PATTERNS, THEME_PRESETS, themeFromCafe, type Theme } from "@/lib/theme";
import { SectionTitle, useToast } from "@/components/ux";
import { ThemeStyles } from "@/components/theme";

const RADII = [
  { id: "sharp", label: "Sharp" },
  { id: "rounded", label: "Rounded" },
  { id: "soft", label: "Super soft" },
] as const;

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/[.04] p-3">
      <span className="text-sm font-bold">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase text-stone-400">{value}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-9 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0.5" />
      </span>
    </label>
  );
}

export default function DesignPage() {
  const toast = useToast();
  const [theme, setTheme] = useState<Theme>({ primary: "#c2410c", accent: "#f59e0b", bg: "#0c0a09", bgMode: "solid", pattern: "none", font: "inter", radius: "rounded" });
  const [cafeName, setCafeName] = useState("Your Cafe");
  const [logo, setLogo] = useState("☕");
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Theme) => (v: Theme[keyof Theme]) => setTheme((t) => ({ ...t, [k]: v }));

  useEffect(() => {
    fetch("/api/cafe").then(async (r) => {
      const j = await r.json();
      if (j.cafe) {
        setCafeName(j.cafe.name); setLogo(j.cafe.logoEmoji || "☕");
        setTheme(themeFromCafe(j.cafe));
      }
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const cafe = await fetch("/api/cafe").then((r) => r.json()).then((j) => j.cafe);
      const r = await fetch("/api/cafe", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cafe.name, tagline: cafe.tagline, description: cafe.description, upiId: cafe.upiId, gstPct: cafe.gstPct,
          themePrimary: theme.primary, themeAccent: theme.accent, themeBg: theme.bg, themeBgMode: theme.bgMode, themePattern: theme.pattern, themeFont: theme.font, themeRadius: theme.radius }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      toast("Design published — customer phones update instantly ✨");
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Save failed", "err"); } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionTitle title="Design studio 🎨" sub="Recolour, refont and repattern the entire customer app. Live preview, one tap to publish."
        right={<button onClick={save} disabled={saving} className="rounded-full bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-2.5 text-sm font-black disabled:opacity-60">{saving ? "Publishing…" : "Publish ✨"}</button>} />

      {/* Presets */}
      <p className="mt-4 text-xs font-black tracking-wider text-stone-400">ONE-TAP THEMES</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {THEME_PRESETS.map((p) => (
          <button key={p.name} onClick={() => setTheme(p.theme)}
            className="rounded-2xl border border-white/10 bg-white/[.03] p-3 text-left hover:border-white/25">
            <span className="flex -space-x-1.5">
              <span className="size-6 rounded-full border-2 border-stone-900" style={{ background: p.theme.primary }} />
              <span className="size-6 rounded-full border-2 border-stone-900" style={{ background: p.theme.accent }} />
              <span className="size-6 rounded-full border-2 border-stone-900" style={{ background: p.theme.bg }} />
            </span>
            <span className="mt-1.5 block text-sm font-black">{p.name}</span>
            <span className="block text-[11px] text-stone-500">{p.vibe} • {FONTS[p.theme.font]?.label.split(" (")[0]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <div className="glass h-fit space-y-2 rounded-3xl p-5">
          <p className="text-xs font-black tracking-wider text-stone-400">COLOURS (UNLIMITED — PICK ANY)</p>
          <ColorRow label="🔥 Primary (buttons, prices)" value={theme.primary} onChange={set("primary") as (v: string) => void} />
          <ColorRow label="✨ Accent (highlights)" value={theme.accent} onChange={set("accent") as (v: string) => void} />
          <ColorRow label="🌌 Background" value={theme.bg} onChange={set("bg") as (v: string) => void} />

          <p className="pt-2 text-xs font-black tracking-wider text-stone-400">BACKGROUND STYLE</p>
          <div className="grid grid-cols-2 gap-2">
            {(["solid", "gradient"] as const).map((m) => (
              <button key={m} onClick={() => setTheme({ ...theme, bgMode: m })} className={`rounded-2xl border py-2 text-xs font-black capitalize ${theme.bgMode === m ? "border-orange-500 bg-orange-500/15 text-orange-200" : "border-white/10 text-stone-400"}`}>{m}</button>
            ))}
          </div>

          <p className="pt-2 text-xs font-black tracking-wider text-stone-400">PATTERN</p>
          <div className="grid grid-cols-4 gap-2">
            {PATTERNS.map((p) => (
              <button key={p.id} onClick={() => setTheme({ ...theme, pattern: p.id })} className={`rounded-2xl border py-2 text-xs font-bold ${theme.pattern === p.id ? "border-orange-500 bg-orange-500/15" : "border-white/10 text-stone-400"}`}>{p.emoji}<br />{p.label}</button>
            ))}
          </div>

          <p className="pt-2 text-xs font-black tracking-wider text-stone-400">FONT</p>
          <div className="space-y-1.5">
            {Object.entries(FONTS).map(([id, f]) => (
              <button key={id} onClick={() => setTheme({ ...theme, font: id })} style={{ fontFamily: f.family }}
                className={`w-full rounded-2xl border px-4 py-2.5 text-left text-sm font-bold ${theme.font === id ? "border-orange-500 bg-orange-500/15" : "border-white/10"}`}>
                {f.label} <span className="opacity-60">— AaBbCc 123</span>
              </button>
            ))}
          </div>

          <p className="pt-2 text-xs font-black tracking-wider text-stone-400">CORNERS</p>
          <div className="grid grid-cols-3 gap-2">
            {RADII.map((r) => (
              <button key={r.id} onClick={() => setTheme({ ...theme, radius: r.id })} className={`border py-2 text-xs font-bold ${theme.radius === r.id ? "border-orange-500 bg-orange-500/15" : "border-white/10 text-stone-400"}`} style={{ borderRadius: r.id === "sharp" ? 6 : r.id === "soft" ? 22 : 14 }}>{r.label}</button>
            ))}
          </div>
        </div>

        {/* Live phone preview */}
        <div className="lg:sticky lg:top-6">
          <p className="mb-2 text-center text-xs font-black tracking-wider text-stone-400">LIVE PREVIEW — EXACTLY WHAT CUSTOMERS SEE</p>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl">
            <ThemeStyles theme={theme}>
              <div className="px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="t-grad grid size-11 place-items-center rounded-2xl text-2xl">{logo}</span>
                  <div><p className="t-heading font-black leading-tight">{cafeName}</p><p className="t-accent-text text-[11px] font-bold">TABLE T1 • Scan. Order. Sip. Repeat.</p></div>
                </div>
                <div className="t-card mt-3 border border-white/10 bg-white/5 px-4 py-2.5 text-sm opacity-80">🔍 Craving something? Search…</div>
                <div className="mt-2 flex gap-2">
                  <span className="t-grad rounded-full px-4 py-1.5 text-xs font-bold text-white">All</span>
                  <span className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold opacity-80">⭐ Popular</span>
                  <span className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold opacity-80">Coffee</span>
                </div>
                <div className="glass t-card mt-3 p-3.5">
                  <div className="flex gap-3">
                    <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl">☕</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold">Cappuccino</p>
                      <p className="t-muted text-xs">Double shot, velvety milk foam</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="font-black">₹149</p>
                        <span className="t-primary-border t-primary-text rounded-full border px-5 py-1.5 text-xs font-black">ADD +</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="t-grad mt-3 rounded-2xl p-4 text-sm font-black text-white">🛒 2 items • ₹298 <span className="float-right">Review order →</span></div>
              </div>
            </ThemeStyles>
          </div>
        </div>
      </div>
    </div>
  );
}
