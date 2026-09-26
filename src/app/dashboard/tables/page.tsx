"use client";
import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { FONTS, themeFromCafe, type Theme } from "@/lib/theme";
import { useToast } from "@/components/ux";

type Table = { id: string; code: string; name: string };
type CardStyle = "clean" | "brand";

export default function TablesPage() {
  const toast = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [appUrl, setAppUrl] = useState("");
  const [cafeName, setCafeName] = useState("Your Outlet");
  const [tagline, setTagline] = useState("Scan. Order. Enjoy.");
  const [logo, setLogo] = useState("☕");
  const [theme, setTheme] = useState<Theme>(themeFromCafe(null));
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [style, setStyle] = useState<CardStyle>(() => {
    try { return (localStorage.getItem("qrserve_card_style") as CardStyle) || "brand"; } catch { return "brand"; }
  });
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function load() {
    const r = await fetch("/api/tables");
    const j = await r.json();
    if (!j.error) { setTables(j.tables); setAppUrl(j.appUrl); }
    const c = await fetch("/api/cafe").then((x) => x.json()).catch(() => null);
    if (c?.cafe) {
      setCafeName(c.cafe.name); setLogo(c.cafe.logoEmoji || "☕");
      setTagline(c.cafe.tagline || "Scan. Order. Enjoy.");
      setTheme(themeFromCafe(c.cafe));
    }
  }
  useEffect(() => { load(); }, []);

  function pickStyle(s: CardStyle) {
    setStyle(s);
    try { localStorage.setItem("qrserve_card_style", s); } catch { /* noop */ }
  }

  const urlFor = (c: string) => `${appUrl}/t/${encodeURIComponent(c)}`;
  const font = FONTS[theme.font] || FONTS.inter;
  const brandBg = theme.bgMode === "gradient"
    ? `linear-gradient(165deg, ${theme.primary} 0%, ${theme.bg} 130%)`
    : theme.bg;

  async function download(t: Table) {
    const el = cardRefs.current[t.id];
    if (!el) return;
    setBusy(t.id);
    try {
      const canvas = await html2canvas(el, { scale: 3, backgroundColor: style === "brand" ? theme.bg : "#ffffff", useCORS: true });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${cafeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${t.code}.png`;
      a.click();
      toast(`${t.code} card downloaded — send it to any print shop 🖨️`);
    } catch {
      toast("Download failed — try Print instead", "err");
    } finally { setBusy(null); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black">Tables & QR 🏷️</h1>
        <button onClick={() => window.print()} className="no-print rounded-full bg-white/10 px-5 py-2 text-sm font-bold">🖨️ Print all cards</button>
      </div>
      <p className="no-print mt-1 text-sm text-stone-400">
        Cards carry your <b>name + Design-studio theme</b> automatically — remote outlets print themselves, zero help needed.
        Print/download from your <b>public domain</b> (never localhost).
      </p>

      {/* Card style picker */}
      <div className="no-print mt-3 flex items-center gap-2">
        <span className="text-xs font-bold text-stone-400">CARD STYLE:</span>
        {([
          { id: "brand", label: "🔥 Brand — full theme, dark", sw: `linear-gradient(135deg, ${theme.primary}, ${theme.bg})` },
          { id: "clean", label: "⬜ Clean — white, ink-saver", sw: "#ffffff" },
        ] as const).map((o) => (
          <button key={o.id} onClick={() => pickStyle(o.id)}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-bold ${style === o.id ? "border-orange-500 bg-orange-500/15" : "border-white/10"}`}>
            <span className="size-5 rounded-md border border-white/20" style={{ background: o.sw }} />{o.label}
          </button>
        ))}
      </div>

      <div className="no-print mt-4 flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder="New table code (T13)" className="w-48 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none" />
        <button onClick={async () => { if (!code.trim()) return; const r = await fetch("/api/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) }); const j = await r.json(); if (!r.ok) return alert(j.error); setCode(""); load(); }} className="rounded-2xl bg-orange-600 px-5 text-sm font-black">+ Add</button>
      </div>

      <link rel="stylesheet" href={font.href} />
      <div className="qr-print-grid mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <div key={t.id}>
            <div
              ref={(el) => { cardRefs.current[t.id] = el; }}
              className="qr-card mx-auto w-full max-w-[340px] overflow-hidden rounded-[28px] text-center shadow-2xl"
              style={style === "brand"
                ? { fontFamily: font.family, background: brandBg, color: "#fff" }
                : { fontFamily: font.family, background: "#fff", color: "#1c1917" }}
            >
              {style === "brand" ? (
                <>
                  {/* Full-bleed brand design */}
                  <div className="px-6 pb-4 pt-8">
                    <p className="text-5xl drop-shadow-lg">{logo}</p>
                    <p className="mt-2 text-[28px] font-black leading-tight tracking-tight">{cafeName}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.25em] opacity-80">{tagline}</p>
                    <div className="mx-auto mt-3 h-1 w-24 rounded-full" style={{ background: theme.accent }} />
                  </div>
                  <div className="px-8 pb-2">
                    <div className="rounded-[22px] bg-white px-4 pb-5 pt-5 shadow-inner">
                      {/* Decorative frame — QR itself untouched */}
                      <div className="mx-auto w-fit rounded-[20px] p-[6px]" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>
                        <div className="rounded-[16px] border-2 border-dashed bg-white p-3" style={{ borderColor: `${theme.primary}55` }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/qr?text=${encodeURIComponent(urlFor(t.code))}`} alt={`QR ${t.code}`}
                            className="qr-img mx-auto size-52 bg-white" crossOrigin="anonymous" />
                        </div>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">✦ {cafeName} ✦</p>
                      <p className="qr-title mx-auto mt-2 inline-block rounded-full px-8 py-1.5 text-2xl font-black tracking-widest text-white" style={{ background: theme.primary }}>
                        TABLE {t.code}
                      </p>
                      {t.name && t.name !== t.code && <p className="mt-1 text-xs font-bold text-stone-500">{t.name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1 px-4 pb-2 pt-3 text-[13px] font-bold">
                    <span>📷 Scan</span><span className="opacity-40">→</span>
                    <span>🛒 Order</span><span className="opacity-40">→</span>
                    <span>💳 Pay</span>
                  </div>
                  <p className="qr-sub px-6 pb-1.5 text-[11px] font-semibold opacity-70">No app needed • Works on any phone camera • {cafeName}</p>
                  <p className="px-6 pb-7 text-[10px] font-black uppercase tracking-[0.25em] opacity-50">Powered by Qtable</p>
                </>
              ) : (
                <>
                  {/* Clean ink-saver design */}
                  <div className="px-6 pb-5 pt-7" style={{ background: `linear-gradient(150deg, ${theme.primary}, ${theme.accent})` }}>
                    <p className="text-5xl drop-shadow">{logo}</p>
                    <p className="mt-2 text-[26px] font-black leading-tight tracking-tight text-white">{cafeName}</p>
                    <p className="mt-0.5 text-xs font-bold uppercase tracking-[0.2em] text-white/85">{tagline}</p>
                  </div>
                  <div className="px-8 pb-2 pt-6">
                    {/* Decorative frame — QR itself untouched */}
                    <div className="mx-auto w-fit rounded-[20px] p-[6px]" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>
                      <div className="rounded-[16px] border-2 border-dashed bg-white p-3" style={{ borderColor: `${theme.primary}55` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/qr?text=${encodeURIComponent(urlFor(t.code))}`} alt={`QR ${t.code}`}
                          className="qr-img mx-auto size-52 bg-white" crossOrigin="anonymous" />
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">✦ {cafeName} ✦</p>
                    <p className="qr-title mx-auto mt-2 inline-block rounded-full px-8 py-1.5 text-2xl font-black tracking-widest text-white" style={{ background: theme.primary }}>
                      TABLE {t.code}
                    </p>
                    {t.name && t.name !== t.code && <p className="mt-1 text-xs font-bold text-stone-500">{t.name}</p>}
                  </div>
                  <div className="flex items-center justify-center gap-1 px-4 pb-2 pt-3 text-[13px] font-bold">
                    <span>📷 Scan</span><span className="opacity-30">→</span>
                    <span>🛒 Order</span><span className="opacity-30">→</span>
                    <span>💳 Pay</span>
                  </div>
                  <p className="qr-sub pb-1 text-[11px] font-semibold text-stone-500">No app needed • Works on any phone camera</p>
                  <p className="pb-6 text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Powered by Qtable</p>
                </>
              )}
            </div>
            {/* Screen-only actions */}
            <div className="no-print mt-3 flex justify-center gap-2">
              <button onClick={() => download(t)} disabled={busy === t.id} className="rounded-xl bg-orange-600 px-4 py-1.5 text-xs font-black disabled:opacity-50">
                {busy === t.id ? "Rendering…" : "⬇ PNG"}
              </button>
              <a href={`/t/${t.code}`} target="_blank" className="rounded-xl bg-white/10 px-4 py-1.5 text-xs font-bold">Open ↗</a>
              <button onClick={async () => { if (!confirm(`Delete ${t.code}?`)) return; await fetch(`/api/tables?id=${t.id}`, { method: "DELETE" }); load(); }} className="rounded-xl border border-red-500/30 px-4 py-1.5 text-xs text-red-300">Delete</button>
            </div>
            <p className="qr-url no-print mt-1 break-all text-center text-[11px] text-stone-500">{urlFor(t.code)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
