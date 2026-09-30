export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    NEW: "text-amber-300",
    ACCEPTED: "text-sky-300",
    PREPARING: "text-violet-300",
    READY: "text-emerald-300",
    SERVED: "text-teal-300",
    COMPLETED: "text-stone-400",
    CANCELLED: "text-red-300",
    PAID: "text-emerald-300",
    PENDING: "text-amber-300",
    OPEN: "text-emerald-300",
  };
  return <span className={`stamp ${map[status] || "text-white"}`}>{status}</span>;
}
