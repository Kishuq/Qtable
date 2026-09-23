// Cinematic 12s ecosystem loop — pure CSS, no JS.
// QR glows → phone orders Signature Cappuccino → order travels → kitchen
// receives NEW ORDER #104 → PREPARING → customer status updates.
export function HeroScene() {
  return (
    <div className="relative mx-auto w-full max-w-3xl" aria-hidden="true">
      {/* Traveling order chip */}
      <div className="hero-chip absolute -top-3 z-20 flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-stone-900 px-3 py-1 text-[11px] font-black text-orange-200 shadow-xl">
        <span className="size-1.5 animate-pulse rounded-full bg-orange-400" /> ORDER #104
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* 1 — QR card */}
        <div className="hero-node hero-d1 rounded-3xl border border-white/10 bg-white/[.04] p-4 text-center backdrop-blur">
          <div className="hero-glow hero-d1 mx-auto grid size-20 place-items-center rounded-2xl bg-white p-1.5">
            <div className="grid size-full grid-cols-4 grid-rows-4 gap-0.5 rounded-lg bg-white p-1.5">
              {[
                1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0,
              ].map((v, i) => (
                <span key={i} className={`rounded-[2px] ${v ? "bg-stone-900" : "bg-white"}`} />
              ))}
            </div>
          </div>
          <p className="mt-2.5 text-[11px] font-black uppercase tracking-widest text-stone-300">Table 12</p>
          <p className="text-[10px] font-bold text-stone-500">Scan to start</p>
        </div>

        {/* 2 — Phone */}
        <div className="hero-node hero-d2 rounded-3xl border border-white/10 bg-white/[.04] p-4 backdrop-blur">
          <div className="mx-auto w-fit rounded-2xl border border-white/15 bg-stone-900 p-2">
            <p className="text-[10px] font-black">Signature Cappuccino</p>
            <p className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-stone-300">+ Extra Shot</p>
            <p className="t-grad mt-1.5 rounded-lg py-1 text-center text-[10px] font-black text-white">Added ✓</p>
          </div>
          <p className="mt-2.5 text-center text-[11px] font-black uppercase tracking-widest text-stone-300">Order</p>
          <p className="text-center text-[10px] font-bold text-stone-500">Customized</p>
        </div>

        {/* 3 — Kitchen */}
        <div className="hero-node hero-d3 rounded-3xl border border-white/10 bg-white/[.04] p-4 backdrop-blur">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-2">
            <p className="text-[10px] font-black text-amber-200">NEW ORDER #104</p>
            <p className="mt-0.5 text-[9px] font-bold text-amber-200/70">2× Cappuccino • T12</p>
            <p className="mt-1.5 inline-block rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-black">PREPARING</p>
          </div>
          <p className="mt-2.5 text-center text-[11px] font-black uppercase tracking-widest text-stone-300">Kitchen</p>
          <p className="text-center text-[10px] font-bold text-stone-500">Live queue</p>
        </div>

        {/* 4 — Status */}
        <div className="hero-node hero-d4 rounded-3xl border border-white/10 bg-white/[.04] p-4 text-center backdrop-blur">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/15 text-2xl">🔔</div>
          <p className="mt-2 text-[11px] font-black text-emerald-300">Being prepared</p>
          <p className="text-[10px] font-bold text-stone-500">Live status</p>
        </div>
      </div>

      {/* Stage caption */}
      <div className="relative mt-4 h-6 text-center text-xs font-bold text-stone-400">
        <p className="hero-cap hero-cap-1 absolute inset-0">Customer scans the table QR…</p>
        <p className="hero-cap hero-cap-2 absolute inset-0">Signature Cappuccino + extra shot → cart…</p>
        <p className="hero-cap hero-cap-3 absolute inset-0">Order flies TABLE → QAFE → KITCHEN…</p>
        <p className="hero-cap hero-cap-4 absolute inset-0">Kitchen fires it up — customer gets live status.</p>
      </div>

      {/* Progress */}
      <svg viewBox="0 0 400 12" className="mt-1 w-full" aria-hidden="true">
        <line x1="8" y1="6" x2="392" y2="6" stroke="rgba(255,255,255,.12)" strokeWidth="3" strokeLinecap="round" />
        <line x1="8" y1="6" x2="392" y2="6" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" className="hero-path" />
      </svg>
    </div>
  );
}
