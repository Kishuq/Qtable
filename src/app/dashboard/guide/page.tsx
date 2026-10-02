import Link from "next/link";

const SECTIONS: { title: string; emoji: string; body: string[]; link?: { href: string; label: string } }[] = [
  {
    title: "Daily routine — open & close",
    emoji: "🌅",
    body: [
      "Morning: log in on the counter device, open Orders, tap the alarm banner once so sound works, check that yesterday's unsettled orders are Completed or Cancelled.",
      "During service: keep Orders open with sound ON. Advance every order NEW → ACCEPTED → PREPARING → READY → SERVED. Tap ✓ Received the moment each UPI credit lands in your app.",
      "Closing: complete all SERVED orders, export History → CSV if your accountant needs it, log out shared devices.",
    ],
  },
  {
    title: "Orders tab — your counter brain",
    emoji: "🧾",
    body: [
      "Every scan-to-order lands here in ~3 seconds with a chime, vibration and browser notification.",
      "Tap a status button once — it flips instantly and confirms in the background. If another screen moved it first, you'll get a message and the card snaps back to truth.",
      "UPI orders stay PENDING until you tap ✓ Received. Never tap it without seeing the credit.",
      "Cancel is allowed only from NEW / ACCEPTED / PREPARING — ready food can't be un-made.",
    ],
    link: { href: "/dashboard/orders", label: "Open Orders →" },
  },
  {
    title: "Call Waiter requests",
    emoji: "🛎️",
    body: [
      "Customers tap Call Waiter on the menu — your screens play a distinct triple chime (different from the order bell).",
      "Requests appear as an amber banner on Orders with table + waiting time. Tap On my way ✓, attend, then Done.",
      "One open request per table per 3 minutes — spam-tapping can't flood you.",
    ],
    link: { href: "/dashboard/orders", label: "See requests →" },
  },
  {
    title: "Menu manager",
    emoji: "🍽️",
    body: [
      "Add items with name, price (in ₹), category, veg flag and photo — upload from your phone or paste a URL. Toggle LIVE/HIDDEN to 86 an item mid-rush without deleting it.",
      "Mark bestsellers Popular ⭐ — they surface in the Most-loved rail on customer phones.",
      "Categories group the menu; keep them short (Coffee, Snacks, Desserts).",
    ],
    link: { href: "/dashboard/menu", label: "Open Menu →" },
  },
  {
    title: "Tables & QR printing",
    emoji: "🖨️",
    body: [
      "Add every table (T1…T12), open this page via your PUBLIC domain (never localhost — QRs encode the address bar), hit Print table cards.",
      "Print on 200gsm card or photo paper, laminate against spills, QR at least 3 cm. Test-scan every table with Android + iPhone before laminating.",
      "Each card carries your name, theme and a Powered by Qtable footer automatically.",
    ],
    link: { href: "/dashboard/tables", label: "Open Tables & QR →" },
  },
  {
    title: "Payments — cash, UPI, online",
    emoji: "💳",
    body: [
      "Cash: customer picks Cash, pays at the counter, you tap ✓ Received. Nothing else needed.",
      "Manual UPI: set your UPI ID in Settings once. Customers pay in GPay/PhonePe/Paytm, tap I've Paid, you verify the credit and tap ✓ Received.",
      "Automatic UPI/cards: connect Razorpay keys in Settings → Online payments (Verify & enable). Customers pay inside a secure popup and orders auto-mark PAID with signature verification.",
      "Foreign customers: set Currency (USD, EUR…) — UPI hides itself and card checkout appears via Stripe keys.",
    ],
    link: { href: "/dashboard/settings", label: "Open Settings →" },
  },
  {
    title: "Discounts, staff & design",
    emoji: "🎟️",
    body: [
      "Discounts: create codes (WELCOME10) — customers tap-to-apply them at checkout. Pause anytime without deleting.",
      "Staff: give counter and kitchen their own logins (OWNER / STAFF). Never share one password — every action is audit-logged per user.",
      "Design studio: 14 one-tap themes + unlimited colours, 6 fonts, patterns. Publishes instantly to customer phones, zero redeploy.",
    ],
  },
  {
    title: "History, analytics & billing",
    emoji: "📊",
    body: [
      "Orders tab shows today; History holds everything with date/status/text search, revenue totals and one-click CSV export.",
      "Your subscription (Basic ₹499 / Standard ₹699 / Pro ₹1,299) is per outlet. Unpaid → dashboard shows the plan picker; ordering pauses. Update payment in the billing portal.",
      "Menu plan = display-only menu. Standard adds ordering + payments. Pro adds Discounts, Staff and priority support.",
    ],
  },
  {
    title: "When something looks wrong",
    emoji: "🛠️",
    body: [
      "Orders not appearing? Confirm you're logged into the right outlet, on the Production URL (not a preview link), and the customer scanned a QR printed from the production domain.",
      "No sound? Tap the alarm banner once (browsers demand a tap), allow Notifications, keep the tab open and visible.",
      "Login fails? Use the exact setup email (lowercase), check verified status, or use Forgot password → reset token flow.",
      "Page won't load? Hard-refresh (Ctrl+Shift+R) or Incognito — old cached builds are the usual cause after updates.",
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-500">Owner academy</p>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">The complete Qtable manual 📖</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-400">
        Everything a new owner needs — no trainer required. Work top to bottom once, then keep this page bookmarked for rush-hour questions.
      </p>
      <Link href="/dashboard?tour=1" className="mt-4 inline-block rounded-2xl bg-orange-600 px-6 py-3 text-sm font-black text-white shadow-xl transition hover:bg-orange-500 active:scale-95">
        ▶ Replay the guided tour
      </Link>
      <div className="mt-6 space-y-3">
        {SECTIONS.map((s, i) => (
          <details key={s.title} open={i < 2} className="glass group rounded-3xl p-5 open:pb-5">
            <summary className="cursor-pointer list-none">
              <span className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange-600/15 text-xl">{s.emoji}</span>
                <span>
                  <span className="block text-[11px] font-black text-stone-500">CHAPTER {String(i + 1).padStart(2, "0")}</span>
                  <span className="block font-black text-white">{s.title}</span>
                </span>
                <span className="ml-auto text-stone-500 transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
              {s.body.map((b) => (
                <li key={b.slice(0, 24)} className="flex gap-2.5 text-sm leading-relaxed text-stone-300">
                  <span className="mt-0.5 text-emerald-300">✓</span> {b}
                </li>
              ))}
            </ul>
            {s.link && (
              <Link href={s.link.href} className="mt-3 inline-block rounded-xl bg-orange-600 px-4 py-2 text-xs font-black text-white transition hover:bg-orange-500 active:scale-95">
                {s.link.label}
              </Link>
            )}
          </details>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-stone-500">Powered by Qtable • Scan. Order. Flow.</p>
    </div>
  );
}
