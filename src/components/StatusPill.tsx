export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    ACCEPTED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    PREPARING: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    READY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    SERVED: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    COMPLETED: "bg-stone-500/15 text-stone-300 border-stone-500/30",
    CANCELLED: "bg-red-500/15 text-red-300 border-red-500/30",
    PAID: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${map[status] || "bg-white/10 text-white border-white/20"}`}>
      {status}
    </span>
  );
}
