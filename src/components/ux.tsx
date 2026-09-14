"use client";
import { createContext, useCallback, useContext, useState } from "react";

// ---------- Toasts ----------
type Toast = { id: number; msg: string; kind: "ok" | "err" | "info" };
const ToastCtx = createContext<(msg: string, kind?: Toast["kind"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={`animate-toast-in pointer-events-auto w-full rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl ${
            t.kind === "ok" ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-200"
            : t.kind === "err" ? "border-red-500/40 bg-red-950/90 text-red-200"
            : "border-white/20 bg-stone-900/95 text-stone-100"
          }`}>
            {t.kind === "ok" ? "✅ " : t.kind === "err" ? "⚠️ " : "🔔 "}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------- Skeletons ----------
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-2xl bg-gradient-to-r from-white/5 via-white/10 to-white/5 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex gap-3">
        <Skeleton className="size-20 shrink-0 !rounded-2xl" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-1/3" /></div>
      </div>
    </div>
  );
}

// ---------- Empty state ----------
export function EmptyState({ emoji, title, hint }: { emoji: string; title: string; hint?: string }) {
  return (
    <div className="glass rounded-3xl px-6 py-12 text-center">
      <p className="text-5xl">{emoji}</p>
      <p className="mt-3 font-black">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-xs text-sm text-stone-400">{hint}</p>}
    </div>
  );
}

// ---------- Food photo with emoji fallback (never shows a broken image) ----------
export function ItemPhoto({ url, emoji, size = "size-20", rounded = "rounded-2xl" }: { url?: string; emoji: string; size?: string; rounded?: string }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return <span className={`grid ${size} shrink-0 place-items-center ${rounded} bg-gradient-to-br from-white/10 to-white/[.02] text-3xl`}>{emoji}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" onError={() => setErr(true)}
      className={`${size} shrink-0 ${rounded} bg-white/5 object-cover`} />
  );
}

// ---------- Section heading ----------
export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div><h1 className="text-2xl font-black tracking-tight">{title}</h1>{sub && <p className="mt-0.5 text-sm text-stone-400">{sub}</p>}</div>
      {right}
    </div>
  );
}
