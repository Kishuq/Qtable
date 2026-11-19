import Link from "next/link";

// Shown when a QR / link points at an outlet or table that does not exist.
// Printer cards age badly: outlets rename tables, staff move, guests retype
// links. A dead-end 404 makes the guest blame the café; this one tells them
// exactly what to do next.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-20 text-center">
      <p className="grid size-16 place-items-center rounded-3xl bg-orange-600/15 text-3xl">🔍</p>
      <h1 className="mt-5 text-2xl font-black tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-400">
        The QR or link may be old, or the table may have been renamed.
        Scan the QR printed on your table, or ask the counter for help.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-2xl bg-orange-600 px-6 py-3 text-sm font-black text-white transition hover:bg-orange-500 active:scale-95"
      >
        Go to Qtable →
      </Link>
      <p className="mt-4 text-[11px] text-stone-500">Outlet owner? Open your dashboard to print fresh QR cards.</p>
    </div>
  );
}
