"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_THEME, FONTS, PATTERNS, STYLES, THEME_PRESETS, themeFromCafe, type Theme, type ThemeStyle } from "@/lib/theme";
import { analyzeImage, describeAnalysis, fileToCompactDataUrl, looksFromPhoto, type PhotoLook } from "@/lib/palette";
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

// Tiny wireframe so each layout is recognisable before you tap it.
function StyleGlyph({ id }: { id: ThemeStyle }) {
  const bar = "rounded-sm bg-current";
  if (id === "editorial") return (
    <span className="flex w-12 flex-col gap-1.5 opacity-70">
      <span className="mx-auto h-1 w-8 rounded bg-current" />
      <span className={`h-px w-full ${bar}`} />
      <span className={`h-px w-11/12 ${bar}`} />
      <span className={`h-px w-full ${bar}`} />
      <span className={`h-px w-10/12 ${bar}`} />
    </span>
  );
  if (id === "list") return (
    <span className="flex w-12 flex-col gap-1.5 opacity-70">
      {[0, 1, 2].map((i) => <span key={i} className="flex items-center gap-1"><span className="size-3 rounded bg-current" /><span className={`h-1 flex-1 ${bar}`} /></span>)}
    </span>
  );
  if (id === "poster") return (
    <span className="grid w-12 grid-cols-2 gap-1 opacity-70">
      <span className="h-8 rounded-sm bg-current" />
      <span className="h-8 rounded-sm bg-current/70" />
      <span className="h-8 rounded-sm bg-current/70" />
      <span className="h-8 rounded-sm bg-current" />
    </span>
  );
  if (id === "tickets") return (
    <span className="flex w-12 flex-col gap-1.5 opacity-70">
      {[0, 1].map((i) => <span key={i} className="h-4 rounded-sm border border-dashed border-current" />)}
    </span>
  );
  return (
    <span className="grid w-12 grid-cols-2 gap-1 opacity-70">
      <span className="rounded-sm bg-current" style={{ height: 22 }} />
      <span className="rounded-sm bg-current/70" style={{ height: 22 }} />
    </span>
  );
}

export default function DesignPage() {
  const toast = useToast();
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [cafeName, setCafeName] = useState("Your Outlet");
  const [logo, setLogo] = useState("☕");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [photo, setPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [looks, setLooks] = useState<PhotoLook[]>([]);
  const [photoErr, setPhotoErr] = useState("");
  const [detected, setDetected] = useState("");
  const [useBackdrop, setUseBackdrop] = useState(false);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Theme) => (v: Theme[keyof Theme]) => setTheme((t) => ({ ...t, [k]: v }));

  useEffect(() => {
    fetch("/api/cafe").then(async (r) => {
      const j = await r.json();
      if (j.cafe) {
        setCafeName(j.cafe.name); setLogo(j.cafe.logoEmoji || "☕");
        const t = themeFromCafe(j.cafe);
        setTheme(t);
        if (t.image) setUseBackdrop(true);
      }
    }).catch(() => {});
  }, []);

  async function onPhoto(file: File) {
    if (!file.type.startsWith("image/")) { setPhotoErr("Choose a JPG, PNG or WebP image."); return; }
    if (file.size > 12 * 1024 * 1024) { setPhotoErr("That photo is over 12 MB — pick a smaller one."); return; }
    setAnalyzing(true); setPhotoErr("");
    try {
      const dataUrl = await fileToCompactDataUrl(file);
      const analysis = await analyzeImage(dataUrl);
      const next = looksFromPhoto(analysis);
      setLooks(next);
      setPhoto({ name: file.name, dataUrl });
      setDetected(describeAnalysis(analysis));
      // The whole point: the menu should immediately look like the photo.
      setUseBackdrop(true);
      setTheme({ ...next[0].theme, image: dataUrl });
      toast("Design matched to your photo — every colour, font and layout followed ✨");
    } catch (e: unknown) {
      setPhotoErr(e instanceof Error ? e.message : "Couldn't read that image.");
    } finally { setAnalyzing(false); }
  }

  function applyLook(look: PhotoLook) {
    setTheme({ ...look.theme, image: useBackdrop && photo ? photo.dataUrl : "" });
    toast(`${look.label} applied — tweak it or publish ✨`);
  }

  function toggleBackdrop(on: boolean) {
    setUseBackdrop(on);
    setTheme((t) => ({ ...t, image: on && photo ? photo.dataUrl : "" }));
  }

  function clearPhoto() {
    setPhoto(null); setLooks([]); setUseBackdrop(false); setDetected("");
    setTheme((t) => ({ ...t, image: "" }));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    setSaving(true);
    try {
      const cafe = await fetch("/api/cafe").then((r) => r.json()).then((j) => j.cafe);
      const r = await fetch("/api/cafe", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cafe.name, tagline: cafe.tagline, description: cafe.description, upiId: cafe.upiId, gstPct: cafe.gstPct,
          themePrimary: theme.primary, themeAccent: theme.accent, themeBg: theme.bg, themeBgMode: theme.bgMode, themePattern: theme.pattern,
          themeFont: theme.font, themeRadius: theme.radius, themeStyle: theme.style, themeImage: theme.image || "", themeWash: theme.wash }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Save failed");
      toast("Design published — customer phones update instantly ✨");
    } catch (e: unknown) { toast(e instanceof Error ? e.message : "Save failed", "err"); } finally { setSaving(false); }
  }

  const activeStyle = STYLES.find((s) => s.id === theme.style) || STYLES[0];

  return (
    <div>
      <SectionTitle title="Design studio 🎨" sub="24 hand-built looks and five real menu layouts. Or upload a photo — the palette, layout, type, texture and corners are all built from it. Live preview, one tap to publish."
        right={<button onClick={save} disabled={saving} className="rounded-full bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-2.5 text-sm font-black disabled:opacity-60">{saving ? "Publishing…" : "Publish ✨"}</button>} />

      {/* ---------- Match a photo ---------- */}
      <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/15 via-stone-900 to-stone-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black">✨ Match your menu to a photo</p>
            <p className="mt-0.5 max-w-md text-xs leading-relaxed text-stone-400">
              Upload your logo, interior, packaging or a moodboard. We read its warmth, contrast and detail, then build the whole menu around it — colours, layout style, typography, texture and corner shape. No design skills, no AI service, no storage service.
            </p>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={analyzing}
            className="rounded-full bg-white px-5 py-2.5 text-xs font-black text-stone-900 transition active:scale-95 disabled:opacity-60">
            {analyzing ? "Reading your photo…" : photo ? "Choose another photo" : "Upload a photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); }} />
        </div>

        {photoErr && <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200">{photoErr}</p>}

        {photo && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.dataUrl} alt="Your upload" className="size-16 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">{photo.name}</p>
              <p className="text-[11px] text-stone-400">
                {detected ? <>Detected: <span className="font-bold text-orange-200">{detected}</span> — layout, type and texture followed it.</> : "Bundled into your design — no storage service needed."}
              </p>
            </div>
            <label className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black ${useBackdrop ? "border-orange-400 bg-orange-500/20 text-orange-100" : "border-white/15 text-stone-300"}`}>
              <input type="checkbox" checked={useBackdrop} onChange={(e) => toggleBackdrop(e.target.checked)} className="accent-orange-500" />
              Use as backdrop
            </label>
            <button onClick={clearPhoto} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-bold text-stone-400">Remove</button>
          </div>
        )}

        {looks.length > 0 && (
          <>
            <p className="mt-4 text-xs font-black tracking-wider text-stone-400">THREE DESIGNS FROM THIS PHOTO — TAP ONE</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {looks.map((look) => (
                <button key={look.label} onClick={() => applyLook(look)}
                  className="group rounded-2xl border border-white/10 bg-white/[.03] p-3 text-left transition hover:border-white/30 hover:bg-white/[.06] active:scale-[.99]">
                  <span className="flex items-center gap-1.5">
                    {[look.theme.primary, look.theme.accent, look.theme.bg].map((c, i) => (
                      <span key={i} className="size-6 rounded-full border-2 border-stone-900 ring-1 ring-white/15" style={{ background: c }} />
                    ))}
                    <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-stone-500">{look.theme.style}</span>
                  </span>
                  <span className="mt-2 block text-sm font-black">{look.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-stone-400">{look.note}</span>
                  <span className="mt-2 block text-[11px] font-black text-orange-300 transition group-hover:translate-x-0.5">Apply this look →</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ---------- Layout style ---------- */}
      <div className="mt-5 flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black tracking-wider text-stone-400">MENU LAYOUT</p>
          <p className="mt-0.5 text-[11px] text-stone-500">{activeStyle.note}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STYLES.map((s) => (
          <button key={s.id} onClick={() => setTheme({ ...theme, style: s.id })}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition active:scale-[.98] ${theme.style === s.id ? "border-orange-500 bg-orange-500/15 text-orange-100" : "border-white/10 bg-white/[.03] text-stone-400 hover:border-white/25"}`}>
            <StyleGlyph id={s.id} />
            <span className="text-[11px] font-black">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ---------- Presets ---------- */}
      <div className="mt-5 flex items-end justify-between gap-2">
        <p className="text-xs font-black tracking-wider text-stone-400">CURATED THEMES — 24 TO START FROM</p>
        <button onClick={() => setShowAllPresets((v) => !v)} className="text-[11px] font-black text-orange-300">
          {showAllPresets ? "Show less" : `Show all ${THEME_PRESETS.length}`}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {(showAllPresets ? THEME_PRESETS : THEME_PRESETS.slice(0, 8)).map((p) => (
          <button key={p.name} onClick={() => setTheme({ ...p.theme, image: useBackdrop && photo ? photo.dataUrl : "" })}
            className="rounded-2xl border border-white/10 bg-white/[.03] p-3 text-left transition hover:border-white/25 hover:bg-white/[.06] active:scale-[.99]">
            <span className="flex -space-x-1.5">
              <span className="size-6 rounded-full border-2 border-stone-900" style={{ background: p.theme.primary }} />
              <span className="size-6 rounded-full border-2 border-stone-900" style={{ background: p.theme.accent }} />
              <span className="size-6 rounded-full border-2 border-stone-900" style={{ background: p.theme.bg }} />
            </span>
            <span className="mt-1.5 block text-sm font-black">{p.name}</span>
            <span className="block text-[11px] text-stone-500">{p.vibe} • {STYLES.find((s) => s.id === p.theme.style)?.label}</span>
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

          {theme.image && (
            <>
              <p className="pt-2 text-xs font-black tracking-wider text-stone-400">PHOTO VISIBILITY</p>
              <label className="block rounded-2xl bg-white/[.04] p-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold">Backdrop strength</span>
                  <span className="font-mono text-xs font-black text-orange-200">{100 - theme.wash}%</span>
                </span>
                <input
                  type="range" min={2} max={45} step={1}
                  value={Math.min(45, Math.max(2, 100 - theme.wash))}
                  onChange={(e) => setTheme((t) => ({ ...t, wash: 100 - Number(e.target.value) }))}
                  aria-label="Photo backdrop strength"
                  className="mt-2 w-full accent-orange-500"
                />
                <span className="mt-1 block text-[11px] leading-snug text-stone-500">
                  Low = the photo whispers behind the menu. High = you can see the room. Text stays readable either way.
                </span>
              </label>
              <p className="text-[11px] leading-snug text-stone-500">
                The photo also sets your colours, menu layout, font, texture and corner shape — change the palette above and it all keeps following it.
              </p>
              <button onClick={() => toggleBackdrop(false)} className="w-full rounded-2xl border border-white/10 py-2 text-xs font-black text-stone-300">
                Remove photo backdrop
              </button>
            </>
          )}
        </div>

        {/* Live phone preview */}
        <div className="lg:sticky lg:top-6">
          <p className="mb-2 text-center text-xs font-black tracking-wider text-stone-400">LIVE PREVIEW — EXACTLY WHAT CUSTOMERS SEE</p>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl">
            <ThemeStyles theme={theme}>
              <div className="px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="t-grad grid size-11 place-items-center rounded-2xl text-2xl">{logo}</span>
                  <div><p className="t-heading font-black leading-tight">{cafeName}</p><p className="t-accent-text text-[11px] font-bold">TABLE T1 • Scan. Order. Enjoy.</p></div>
                </div>
                <div className="t-card mt-3 border border-white/10 bg-white/5 px-4 py-2.5 text-sm opacity-80">🔍 Craving something? Search…</div>
                <div className="mt-2 flex gap-2">
                  <span className="t-grad rounded-full px-4 py-1.5 text-xs font-bold text-white">All</span>
                  <span className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold opacity-80">⭐ Popular</span>
                  <span className="rounded-full bg-white/5 px-4 py-1.5 text-xs font-bold opacity-80">Coffee</span>
                </div>
                <PreviewBody style={theme.style} />
                <div className="t-grad mt-3 rounded-2xl p-4 text-sm font-black text-white">🛒 2 items • ₹298 <span className="float-right">Review order →</span></div>
              </div>
            </ThemeStyles>
          </div>
          <p className="mt-2 text-center text-[11px] text-stone-500">Layout: {activeStyle.label} • {FONTS[theme.font]?.label.split(" (")[0]}</p>
        </div>
      </div>
    </div>
  );
}

function PreviewBody({ style }: { style: ThemeStyle }) {
  const dishes = [
    { name: "Cappuccino", desc: "Double shot, velvety milk foam", price: "₹149", emoji: "☕" },
    { name: "Masala Toast", desc: "Sourdough, chilli butter, coriander", price: "₹189", emoji: "🍞" },
  ];
  if (style === "editorial") {
    return (
      <div className="mt-4">
        <p className="t-heading text-center text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Coffee</p>
        <div className="mx-auto mb-2 mt-1.5 h-px w-10 bg-current opacity-20" />
        {dishes.map((d) => (
          <div key={d.name} className="border-b border-current/15 py-2.5">
            <div className="flex items-baseline gap-2"><span className="text-[13px] font-black">{d.name}</span><span className="mb-0.5 flex-1 border-b border-dotted border-current opacity-30" /><span className="text-xs font-black">{d.price}</span></div>
            <p className="t-muted mt-0.5 text-[10px]">{d.desc}</p>
          </div>
        ))}
      </div>
    );
  }
  if (style === "list") {
    return (
      <div className="mt-3 space-y-2">
        {dishes.map((d) => (
          <div key={d.name} className="t-card flex items-center gap-2.5 bg-white/5 p-2">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/10 text-xl">{d.emoji}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{d.name}</span><span className="t-muted block truncate text-[10px]">{d.desc}</span></span>
            <span className="text-xs font-black">{d.price}</span>
          </div>
        ))}
      </div>
    );
  }
  if (style === "tickets") {
    return (
      <div className="mt-3 space-y-2">
        {dishes.map((d) => (
          <div key={d.name} className="border border-dashed border-current/30 px-2.5 py-2" style={{ borderRadius: 10 }}>
            <div className="flex items-baseline gap-2"><span className="text-[11px] font-black uppercase tracking-wide">{d.name}</span><span className="mb-0.5 flex-1 border-b border-dotted border-current opacity-25" /><span className="text-xs font-black">{d.price}</span></div>
            <p className="t-muted mt-0.5 text-[10px]">{d.desc}</p>
          </div>
        ))}
      </div>
    );
  }
  if (style === "poster") {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {dishes.map((d) => (
          <div key={d.name} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/20 to-white/5" style={{ aspectRatio: "3 / 4" }}>
            <div className="grid size-full place-items-center text-4xl opacity-80">{d.emoji}</div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white">
              <p className="text-[11px] font-black leading-tight">{d.name}</p>
              <p className="text-[11px] font-black opacity-95">{d.price}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {dishes.map((d) => (
        <div key={d.name} className="t-card overflow-hidden bg-white/5">
          <div className="grid h-16 place-items-center bg-white/10 text-2xl">{d.emoji}</div>
          <div className="p-2"><p className="truncate text-[11px] font-black">{d.name}</p><p className="t-muted line-clamp-1 text-[9px]">{d.desc}</p>
            <div className="mt-1 flex items-center justify-between"><span className="text-[11px] font-black">{d.price}</span><span className="t-grad rounded-full px-2 py-0.5 text-[9px] font-black text-white">ADD +</span></div></div>
        </div>
      ))}
    </div>
  );
}
