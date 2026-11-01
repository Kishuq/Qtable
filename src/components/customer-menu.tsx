"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { inr, upiLink } from "@/lib/format";
import { CardSkeleton, ItemPhoto, useToast } from "@/components/ux";
import { ThemeStyles } from "@/components/theme";
import { themeFromCafe, type Theme, type ThemeStyle } from "@/lib/theme";

type Item = { id: string; name: string; description: string; price: number; imageEmoji: string; imageUrl: string; veg: boolean; popular: boolean; categoryId: string | null };
type Cat = { id: string; name: string };
type Coupon = { code: string; pct: number };
type CafeTheme = { primary: string; accent: string; bg: string; bgMode: string; pattern: string; font: string; radius: string; style: string; image: string };
type Data = {
  cafe: { name: string; tagline: string; description: string; upiId: string; gstPct: number; currency: string; logoEmoji: string; onlineProvider: string | null; theme: CafeTheme };
  categories: Cat[]; items: Item[]; tables: { code: string }[]; coupons: Coupon[];
  plan?: "menu" | "standard" | "pro";
};

type Sort = "rel" | "lo" | "hi" | "pop";

// Pure customer menu. tableCode comes from the QR (/t/T1); null = opened directly (/).
export function MenuApp({ tableCode }: { tableCode: string | null }) {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");
  const [vegOnly, setVegOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("rel");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [quick, setQuick] = useState<Item | null>(null);
  const [quickQty, setQuickQty] = useState(1);
  const [form, setForm] = useState({
    name: "", phone: "", coupon: "", pay: "COUNTER" as "COUNTER" | "UPI" | "ONLINE",
    note: "", dtype: "DINEIN" as const,
  });
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [waiter, setWaiter] = useState<"idle" | "sending" | "sent">("idle");
  const [usuals, setUsuals] = useState<{ id: string; tokenNo: number; status: string; lines: { menuItemId: string; name: string; qty: number }[] }[]>([]);
  // Subscription plan — the menu plan is read-only (no ordering stack). The
  // plan arrives with the menu payload, so a scan makes one request, not two.
  const [ordering, setOrdering] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const cartKey = `qrserve_cart_${tableCode || "main"}`;

  useEffect(() => {
    fetch("/api/public/cafe").then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Cafe not found");
      if (j?.plan === "menu") setOrdering(false);
      setData(j);
    }).catch((e) => setErr(e.message));
    try {
      const saved = JSON.parse(localStorage.getItem(cartKey) || "{}");
      if (saved && typeof saved === "object") setCart(saved);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* private mode */ }
  }, [cart, cartKey]);

  // One-tap reorder: past orders (saved locally on placement) re-fetched for
  // names, then matched to the live menu so unavailable items are skipped.
  useEffect(() => {
    if (!data) return;
    let alive = true;
    (async () => {
      try {
        const raw = JSON.parse(localStorage.getItem("qrserve_recent") || "[]") as { id: string }[];
        const ids = [...new Set(raw.map((r) => r.id).filter(Boolean))].slice(0, 2);
        const out: { id: string; tokenNo: number; status: string; lines: { menuItemId: string; name: string; qty: number }[] }[] = [];
        for (const oid of ids) {
          try {
            const r = await fetch(`/api/public/order/${oid}`);
            if (!r.ok) continue;
            const j = await r.json();
            const ord = j.order;
            if (!ord?.items?.length) continue;
            out.push({
              id: ord.id,
              tokenNo: ord.tokenNo,
              status: ord.status || "",
              lines: ord.items.map((it: { menuItemId?: string; name: string; qty: number }) => ({
                menuItemId: it.menuItemId || "",
                name: it.name,
                qty: Math.min(20, Math.max(1, it.qty || 1)),
              })),
            });
          } catch { /* one bad id must not kill the rest */ }
        }
        if (alive) setUsuals(out);
      } catch { /* private mode */ }
    })();
    return () => { alive = false; };
  }, [data]);

  function reorder(u: { lines: { menuItemId: string; name: string; qty: number }[] }) {
    if (!data) return;
    const menu = new Map(data.items.filter((m) => m).map((m) => [m.id, m]));
    let added = 0;
    setCart((c) => {
      const n = { ...c };
      for (const l of u.lines) {
        if (l.menuItemId && menu.has(l.menuItemId)) {
          n[l.menuItemId] = Math.min(20, (n[l.menuItemId] || 0) + l.qty);
          added += 1;
        }
      }
      return n;
    });
    if (added > 0) {
      toast("Your usual is back in the cart ✓", "ok");
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      toast("Those items aren't available right now", "err");
    }
  }

  const items = useMemo(() => {
    if (!data) return [];
    const list = data.items.filter((i) =>
      (cat === "ALL" || i.categoryId === cat || (cat === "POPULAR" && i.popular)) &&
      (!vegOnly || i.veg) &&
      (!q || (i.name + " " + i.description).toLowerCase().includes(q.toLowerCase()))
    );
    if (sort === "lo") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "hi") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "pop") return [...list].sort((a, b) => Number(b.popular) - Number(a.popular));
    return list;
  }, [data, cat, vegOnly, q, sort]);

  const popular = useMemo(() => (data ? data.items.filter((i) => i.popular).slice(0, 6) : []), [data]);

  const cartLines = useMemo(() => {
    if (!data) return [];
    return Object.entries(cart).map(([id, qty]) => ({ item: data.items.find((i) => i.id === id)!, qty })).filter((l) => l.item && l.qty > 0);
  }, [cart, data]);
  const subtotal = cartLines.reduce((a, l) => a + l.item.price * l.qty, 0);
  const count = cartLines.reduce((a, l) => a + l.qty, 0);
  const couponPct = data?.coupons.find((c) => c.code === form.coupon.trim().toUpperCase())?.pct || 0;
  const discount = Math.round((subtotal * couponPct) / 100);
  const tax = data ? Math.round(((subtotal - discount) * data.cafe.gstPct) / 100) : 0;
  const total = subtotal - discount + tax;
  const effectiveTable = tableCode || "";

  function add(id: string, name: string, qty = 1) {
    setCart((c) => ({ ...c, [id]: Math.min(20, (c[id] || 0) + qty) }));
    setLastAdded(id);
    setTimeout(() => setLastAdded(null), 400);
    if (!cart[id]) toast(`${name} added`, "ok");
  }
  function sub(id: string) { setCart((c) => { const n = { ...c }; n[id] = (n[id] || 0) - 1; if (n[id] <= 0) delete n[id]; return n; }); }

  async function callWaiter() {
    if (!tableCode || waiter !== "idle") return;
    setWaiter("sending");
    try {
      const r = await fetch("/api/public/waiter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not reach the counter");
      setWaiter("sent");
      toast("Waiter notified — someone's on the way 🛎️", "ok");
      setTimeout(() => setWaiter("idle"), 60000);
    } catch (e: unknown) {
      setWaiter("idle");
      toast(e instanceof Error ? e.message : "Could not reach the counter", "err");
    }
  }

  function saveRecent(id: string, token: number) {
    try {
      const raw = JSON.parse(localStorage.getItem("qrserve_recent") || "[]");
      const next = [{ id, token }, ...raw.filter((r: { id: string }) => r.id !== id)].slice(0, 10);
      localStorage.setItem("qrserve_recent", JSON.stringify(next));
    } catch { /* private mode */ }
  }

  async function createOrder(): Promise<string> {
    // Table auto-identified from QR only — no manual entry.
    if (!tableCode) throw new Error("Please scan the table QR to order.");
    const r = await fetch("/api/public/order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableCode, customerName: form.name || "Guest", customerPhone: form.phone, type: "DINEIN", paymentMode: form.pay, coupon: form.coupon, note: form.note, items: cartLines.map((l) => ({ id: l.item.id, qty: l.qty })) }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Order failed");
    saveRecent(j.order.id, j.order.tokenNo);
    try { localStorage.removeItem(cartKey); } catch { /* noop */ }
    return j.order.id as string;
  }

  function loadRazorpay(): Promise<boolean> {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  async function payOnline(orderId: string, provider: string) {
    if (provider === "stripe") {
      const r = await fetch("/api/public/pay/stripe/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || "Could not start online payment.");
      window.location.href = j.url as string;
      return;
    }
    // Razorpay: verified inline checkout
    const r = await fetch("/api/public/pay/razorpay/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Could not start online payment.");
    if (!(await loadRazorpay())) throw new Error("Payment popup blocked — check connection and retry from tracking page.");
    const RZP = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open(): void } }).Razorpay;
    await new Promise<void>((resolve) => {
      const rz = new RZP({
        key: j.keyId, amount: j.amount, currency: j.currency, name: j.name,
        description: `Order #${j.tokenNo}`, order_id: j.rzpOrderId,
        prefill: { name: form.name || "Guest", contact: form.phone || "" },
        theme: { color: "#c2410c" },
        handler: (resp: unknown) => {
          const d = resp as { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
          fetch("/api/public/pay/razorpay/verify", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, ...d }),
          }).then(async (vr) => {
            if (!vr.ok) {
              const vj = await vr.json().catch(() => ({}));
              toast((vj as { error?: string }).error || "Verification failed", "err");
            } else toast("Payment verified ✓", "ok");
            window.location.href = `/order/${orderId}`;
          }).catch(() => { window.location.href = `/order/${orderId}`; });
          resolve();
        },
        modal: { ondismiss: () => { window.location.href = `/order/${orderId}`; resolve(); } },
      });
      rz.open();
    });
  }

  const razorAuto = (data?.cafe.onlineProvider || null) === "razorpay";

  async function place() {
    setPlacing(true); setErr("");
    try {
      const orderId = await createOrder();
      const provider = data?.cafe.onlineProvider || null;
      // Auto-return flows: ONLINE always; UPI via Razorpay (verified checkout
      // opens the UPI apps itself, then returns + confirms automatically).
      // Plain UPI links can't callback — those stay manual by design.
      if ((form.pay === "ONLINE" || (form.pay === "UPI" && razorAuto)) && provider) {
        try {
          await payOnline(orderId, provider);
          return; // gateway redirected (stripe) or handler redirected (razorpay)
        } catch (e: unknown) {
          // Order EXISTS (kitchen has it) — payment just didn't complete.
          toast(e instanceof Error ? e.message : "Online payment failed", "err");
          window.location.href = `/order/${orderId}`;
          return;
        }
      }
      window.location.href = `/order/${orderId}`;
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Order failed"); } finally { setPlacing(false); }
  }

  const onlineProvider = data?.cafe.onlineProvider || null;
  // UPI is only offered when the owner actually set their UPI ID —
  // otherwise money would have nowhere to go.
  // UPI is India-only: offered only when the outlet bills in INR *and* set its UPI ID.
  // US/EU outlets automatically get Counter + card checkout instead.
  // NOTE: hooks must stay above early returns (React #310).
  const payModes = useMemo(() => {
    const m: ("COUNTER" | "UPI" | "ONLINE")[] = ["COUNTER"];
    if (data?.cafe.upiId && data?.cafe.currency === "INR") m.push("UPI");
    if (onlineProvider) m.push("ONLINE");
    return m;
  }, [data?.cafe.upiId, data?.cafe.currency, onlineProvider]);

  useEffect(() => {
    if (!payModes.includes(form.pay)) setForm((f) => ({ ...f, pay: "COUNTER" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payModes]);
  if (err && !data) return <div className="mx-auto max-w-md flex-1 px-5 py-20 text-center"><p className="text-4xl">😕</p><p className="mt-3 font-bold">{err}</p><Link href="/" className="mt-4 inline-block font-bold text-orange-400">← Home</Link></div>;
  if (!data) return <div className="mx-auto w-full max-w-xl flex-1 space-y-3 px-4 pt-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  const theme: Theme = themeFromCafe(data.cafe.theme);

  const upiUrl = data.cafe.upiId ? upiLink(data.cafe.upiId, data.cafe.name, total / 100, `Table ${effectiveTable}`) : "";
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name || "Chef's picks";
  const flat = sort !== "rel";
  // Layout families: photo-heavy styles keep the 2-up grid, text styles go
  // full width so names, dotted leaders and ticket rules have room.
  // Desktop gets real menu columns instead of one stretched phone column.
  const gridClass =
    theme.style === "cards" || theme.style === "poster"
      ? "grid grid-cols-2 gap-3 sm:gap-3.5 lg:gap-4 xl:grid-cols-3"
      : theme.style === "list"
        ? "space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0"
        : theme.style === "tickets"
          ? "space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-2 lg:space-y-0"
          : "space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-10";

  // "Most loved" must fill its rows — no orphan cards leaving a hole.
  const popCols =
    popular.length === 5 || (popular.length > 4 && popular.length % 3 === 0)
      ? "xl:grid-cols-3"
      : "xl:grid-cols-4";

  return (
    <ThemeStyles theme={theme}>
    <div className="animate-fade-in mx-auto flex w-full max-w-xl flex-1 flex-col pb-32 lg:my-6 lg:grid lg:max-w-7xl lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-5 lg:pb-0">
      {/* Header — branded hero. On phones the photo sits behind it; on desktop
          it becomes a sticky photo panel beside the menu. */}
      <div className="relative overflow-hidden lg:sticky lg:top-6 lg:flex lg:min-h-[32rem] lg:flex-col lg:justify-center lg:rounded-[2rem] lg:border lg:border-white/10 lg:shadow-2xl">
        <div className="t-grad pointer-events-none absolute -top-20 left-1/2 h-56 w-[130%] -translate-x-1/2 rounded-[100%] opacity-25 blur-2xl" />
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--tbg) 72%, transparent) 0%, transparent 100%)" }} />
        <div className="pointer-events-none absolute inset-0 hidden lg:block" style={{ background: "color-mix(in srgb, var(--tbg) 50%, transparent)" }} />
        <div className="relative flex items-center gap-3 px-4 pb-2 pt-5 lg:flex-col lg:items-start lg:gap-4 lg:p-8">
          <span className="t-grad grid size-14 shrink-0 place-items-center rounded-3xl text-3xl shadow-xl ring-1 ring-white/20 lg:size-20 lg:text-5xl">{data.cafe.logoEmoji}</span>
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-xl font-black leading-tight tracking-tight lg:whitespace-normal lg:text-4xl">{data.cafe.name}</p>
            <p className="t-accent-text truncate text-xs font-bold lg:whitespace-normal lg:text-base">{data.cafe.tagline}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:mt-3">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Open now</span>
              {tableCode && <span className="t-grad rounded-full px-2.5 py-0.5 text-[11px] font-black text-white shadow">Table {tableCode} • Dine-in</span>}
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-stone-300">{data.items.length} dishes</span>
            </div>
            <p className="mt-6 hidden max-w-[15rem] text-sm leading-relaxed text-stone-300 lg:block">Scan. Order. Enjoy. — your table, your pace, no waiting to catch an eye.</p>
          </div>
        </div>
      </div>

      {/* Menu sheet — solid enough that names and prices stay readable over any
          photo; on desktop the photo frames a proper menu card instead of
          fighting the text. */}
      <div className="relative flex flex-1 flex-col rounded-t-[1.75rem] border-t border-white/10 lg:mb-6 lg:rounded-t-[2rem] lg:rounded-b-[2rem] lg:border lg:border-white/10 lg:shadow-2xl"
        style={{ background: "color-mix(in srgb, var(--tbg) 90%, transparent)" }}>
      <div className="sticky top-0 z-30 rounded-t-[1.75rem] border-b border-white/10 backdrop-blur-xl lg:rounded-t-[2rem]" style={{ background: "color-mix(in srgb, var(--tbg) 93%, transparent)" }}>
        <div className="px-4 pb-2.5 pt-2 lg:px-8 lg:pt-3">
        <div className="flex gap-2 pb-2.5">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Craving something? Search…" className="t-card min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none transition focus:border-orange-500/60 focus:bg-white/10" />
          <button onClick={() => setVegOnly(!vegOnly)} className={`shrink-0 rounded-full border px-3.5 text-xs font-black transition active:scale-95 ${vegOnly ? "border-green-500 bg-green-500/15 text-green-300 shadow-lg shadow-green-500/20" : "border-white/10 bg-white/5 opacity-70 hover:opacity-100"}`}>● VEG</button>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="t-card shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-2.5 text-xs font-bold outline-none" title="Sort dishes">
            <option value="rel">✨ For you</option>
            <option value="pop">🔥 Popular</option>
            <option value="lo">₹ Low → High</option>
            <option value="hi">₹ High → Low</option>
          </select>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          {[
            { id: "ALL", name: `All • ${data.items.length}` },
            { id: "POPULAR", name: `⭐ Popular • ${data.items.filter((m) => m.popular).length}` },
            ...data.categories.map((c) => ({ id: c.id, name: `${c.name} • ${data.items.filter((m) => m.categoryId === c.id).length}` })),
          ].map((c) => (
            <button key={c.id} onClick={() => { setCat(c.id); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition active:scale-95 ${cat === c.id ? "t-grad scale-105 text-white shadow-lg" : "border border-white/10 bg-white/5 text-stone-300 hover:bg-white/10"}`}>{c.name}</button>
          ))}
        </div>
        {ordering && tableCode && (
          <div className="px-4 pb-3 lg:px-8">
            <button
              onClick={callWaiter}
              disabled={waiter !== "idle"}
              className={`w-full rounded-2xl border py-2.5 text-xs font-black transition active:scale-[.99] disabled:opacity-70 lg:mx-auto lg:block lg:w-auto lg:px-8 ${
                waiter === "sent"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              }`}
            >
              {waiter === "sending" ? "Calling… 🛎️" : waiter === "sent" ? "✓ Waiter notified — on the way!" : "🛎️ Need help? Call Waiter"}
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Live order — jump back to tracking after returning to the menu */}
      {(() => {
        const live = usuals.find((u) => ["NEW", "ACCEPTED", "PREPARING", "READY"].includes(u.status));
        if (!live) return null;
        return (
          <div className="px-4 pt-3 lg:px-8">
            <Link
              href={`/order/${live.id}`}
              className="t-grad anim-rise flex items-center justify-between rounded-2xl p-4 text-white shadow-xl transition hover:brightness-110 active:scale-[.99]"
            >
              <span>
                <span className="block text-[11px] font-bold opacity-85">🔔 Your order is live</span>
                <span className="block text-sm font-black">#{live.tokenNo} • {live.status.charAt(0) + live.status.slice(1).toLowerCase()}</span>
              </span>
              <span className="shrink-0 rounded-full bg-black/25 px-4 py-2 text-xs font-black">Track →</span>
            </Link>
          </div>
        );
      })()}

      {/* Offers */}
      {ordering && data.coupons.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-4 lg:px-8">
          {data.coupons.map((c) => (
            <button key={c.code} onClick={() => { setForm({ ...form, coupon: c.code }); setCheckout(true); }}
              className="card-hover group flex shrink-0 items-center gap-2.5 rounded-2xl border border-dashed border-amber-500/60 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-4 py-2.5 text-xs font-black text-amber-200 shadow-lg shadow-amber-500/10">
              <span className="t-grad grid size-7 place-items-center rounded-xl text-sm">🎉</span>
              <span>{c.code} — {c.pct}% OFF</span>
              <span className="text-amber-400/70 transition group-hover:translate-x-0.5">tap to use →</span>
            </button>
          ))}
        </div>
      )}

      {/* Your usual — one-tap reorder for regulars */}
      {ordering && count === 0 && usuals.length > 0 && (
        <div className="px-4 pt-4 lg:px-8">
          <div className="glass t-card card-hover anim-rise rounded-3xl border-orange-500/30 p-4">
            <p className="text-sm font-black">👋 Welcome back — your usual?</p>
            {usuals.slice(0, 1).map((u) => (
              <div key={u.id} className="mt-2">
                <p className="truncate text-xs text-stone-300">
                  #{u.tokenNo} • {u.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                </p>
                <button
                  onClick={() => reorder(u)}
                  className="t-grad mt-2.5 w-full rounded-2xl py-2.5 text-xs font-black text-white shadow-lg transition hover:brightness-110 active:scale-95"
                >
                  Reorder in one tap ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular rail */}
      {cat === "ALL" && !q && sort === "rel" && popular.length > 0 && (
        <div className="pt-5">
          <div className="flex items-center justify-between px-4 lg:px-8">
            <p className="t-heading text-sm font-black">🔥 Most loved right now</p>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-stone-400">{popular.length} picks</span>
          </div>
          <div className={`no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pt-2.5 xl:grid ${popCols} xl:gap-4 xl:overflow-visible xl:px-8 xl:pt-3`}>
            {popular.map((i, idx) => (
              <div key={i.id} className="glass t-card card-hover animate-slide-up w-44 shrink-0 snap-start overflow-hidden xl:w-auto" style={{ animationDelay: `${Math.min(idx, 6) * 60}ms` }}>
                <button className="group relative block h-28 w-full overflow-hidden xl:h-44" onClick={() => { setQuick(i); setQuickQty(1); }}>
                  <span className="block size-full transition duration-300 group-hover:scale-105"><ItemPhoto url={i.imageUrl} emoji={i.imageEmoji} size="size-full" rounded="rounded-none" /></span>
                  <span className="t-grad absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 text-[11px] font-black text-white shadow-lg">{inr(i.price, data.cafe.currency)}</span>
                </button>
                <div className="p-3"><p className="truncate text-xs font-black">{i.name}</p>
                  {ordering && <button onClick={() => add(i.id, i.name)} className="t-grad mt-2 w-full rounded-xl py-2 text-[11px] font-black text-white shadow-lg transition hover:brightness-110 active:scale-95">ADD +</button>}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div ref={listRef} className="scroll-mt-44 space-y-6 px-4 pt-5 lg:space-y-8 lg:px-8 lg:pt-7">
        <div className="flex flex-wrap items-center gap-2">
          <p className="t-heading text-sm font-black">Explore the menu</p>
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-stone-400">
            {items.length} dish{items.length === 1 ? "" : "es"}
            {cat !== "ALL" ? ` • ${cat === "POPULAR" ? "Popular" : data.categories.find((c) => c.id === cat)?.name}` : ""}
            {sort !== "rel" ? ` • ${sort === "lo" ? "Low → High" : sort === "hi" ? "High → Low" : "Popular first"}` : ""} • incl. GST
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        {flat ? (
          <div className={gridClass}>
            {items.map((i, idx) => <DishCard key={i.id} item={i} currency={data.cafe.currency} style={theme.style} qty={cart[i.id] || 0} lastAdded={lastAdded === i.id} index={idx} ordering={ordering} onAdd={() => add(i.id, i.name)} onSub={() => sub(i.id)} onQuick={() => { setQuick(i); setQuickQty(1); }} />)}
          </div>
        ) : (data.categories.map((c) => {
          const list = items.filter((i) => i.categoryId === c.id);
          if (list.length === 0) return null;
          return (
            <div key={c.id}>
              <CategoryHead name={c.name} count={list.length} style={theme.style} />
              <div className={gridClass}>
                {list.map((i, idx) => <DishCard key={i.id} item={i} currency={data.cafe.currency} style={theme.style} qty={cart[i.id] || 0} lastAdded={lastAdded === i.id} index={idx} ordering={ordering} onAdd={() => add(i.id, i.name)} onSub={() => sub(i.id)} onQuick={() => { setQuick(i); setQuickQty(1); }} />)}
              </div>
            </div>
          );
        }))}
        {items.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-4xl">🍽️</p>
            <p className="t-muted mt-2 text-sm">Nothing matches — try another craving.</p>
            <button onClick={() => { setQ(""); setCat("ALL"); setVegOnly(false); setSort("rel"); }} className="mt-3 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-black transition hover:bg-white/10 active:scale-95">
              Clear all filters ✕
            </button>
          </div>
        )}
      </div>

      {!ordering && (
        <div className="px-4 pt-3 lg:px-8">
          <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-xs font-bold text-stone-300">
            📖 Menu-only plan — please order at the counter.
          </p>
        </div>
      )}

      {/* Cart bar */}
      {ordering && count > 0 && !checkout && !quick && (
        <button onClick={() => setCheckout(true)} className="t-grad animate-pulse-ring fixed bottom-5 left-1/2 z-40 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-3xl border border-white/20 p-4 text-left font-black text-white shadow-2xl transition active:scale-[.98]">
          <span className="flex items-center justify-between gap-3"><span className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-2xl bg-black/25 text-lg">🛒</span><span><span className="block text-sm">{count} item{count > 1 ? "s" : ""} • {inr(subtotal, data.cafe.currency)}</span><span className="block text-[11px] font-bold opacity-80">GST included • tap to review</span></span></span><span className="shrink-0 rounded-full bg-black/25 px-4 py-2 text-sm">Review →</span></span>
        </button>
      )}

      {/* Quick view */}
      {quick && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => setQuick(null)}>
          <div className="animate-sheet-up w-full max-w-md overflow-hidden rounded-t-3xl bg-stone-900 text-stone-100 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-56">
              <ItemPhoto url={quick.imageUrl} emoji={quick.imageEmoji} size="size-full" rounded="rounded-none" />
              <button onClick={() => setQuick(null)} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60 text-white">✕</button>
              {quick.popular && <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-black">★ POPULAR</span>}
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2">
                <span className={`grid size-4 place-items-center rounded border text-[10px] ${quick.veg ? "border-green-500 text-green-500" : "border-red-500 text-red-500"}`}>●</span>
                <h3 className="text-lg font-black">{quick.name}</h3>
              </div>
              <p className="mt-1 text-sm text-stone-400">{quick.description || "Made fresh to order."}</p>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xl font-black">{inr(quick.price, data.cafe.currency)}</p>
                <div className="flex items-center gap-3 rounded-full bg-white/10 px-2 py-1.5">
                  <button onClick={() => setQuickQty(Math.max(1, quickQty - 1))} className="grid size-8 place-items-center rounded-full bg-white/10 text-lg font-black">−</button>
                  <span className="min-w-5 text-center font-black">{quickQty}</span>
                  <button onClick={() => setQuickQty(Math.min(20, quickQty + 1))} className="grid size-8 place-items-center rounded-full bg-white/10 text-lg font-black">+</button>
                </div>
              </div>
              <button onClick={() => { add(quick.id, quick.name, quickQty); setQuick(null); }} className="t-grad mt-4 w-full rounded-2xl py-3.5 font-black text-white">
                Add {quickQty} • {inr(quick.price * quickQty, data.cafe.currency)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout sheet */}
      {checkout && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => setCheckout(false)}>
          <div className="animate-sheet-up max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-stone-900 p-6 text-stone-100 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Your order{tableCode ? <span className="t-accent-text"> • Table {tableCode}</span> : null}</h2>
              <button onClick={() => setCheckout(false)} className="grid size-8 place-items-center rounded-full bg-white/5 text-stone-400">✕</button>
            </div>

            {!tableCode && (
              <p className="t-card mt-3 w-full border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-200">Please scan the table QR to order — table is detected automatically.</p>
            )}
            <datalist id="table-list">{data.tables.map((t) => <option key={t.code} value={t.code} />)}</datalist>

            <div className="mt-4 space-y-2">
              {cartLines.map((l) => (
                <div key={l.item.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 text-sm">
                  <ItemPhoto url={l.item.imageUrl} emoji={l.item.imageEmoji} size="size-11" rounded="rounded-xl" />
                  <span className="flex-1 truncate">{l.item.name} <span className="text-stone-400">× {l.qty}</span></span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => sub(l.item.id)} className="grid size-6 place-items-center rounded-full bg-white/10 font-black">−</button>
                    <button onClick={() => add(l.item.id, l.item.name)} className="grid size-6 place-items-center rounded-full bg-white/10 font-black">+</button>
                  </div>
                  <span className="w-16 text-right font-bold">{inr(l.item.price * l.qty, data.cafe.currency)}</span>
                </div>
              ))}
              {cartLines.length === 0 && <p className="py-4 text-center text-sm text-stone-500">Your cart is empty — add something tasty first.</p>}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone (optional)" inputMode="tel" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none" />
            </div>
            <div className="mt-2 flex gap-2">
              <input value={form.coupon} onChange={(e) => setForm({ ...form, coupon: e.target.value.toUpperCase() })} placeholder="Coupon code" className="flex-1 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-2.5 text-sm outline-none focus:border-amber-400" />
              {couponPct > 0 && <span className="grid place-items-center rounded-2xl bg-emerald-500/15 px-4 text-xs font-black text-emerald-300">−{couponPct}% ✓</span>}
              {form.coupon.trim() && couponPct === 0 && <span className="grid place-items-center rounded-2xl bg-white/5 px-4 text-xs font-bold text-stone-400">not recognised</span>}
            </div>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note for kitchen (less spicy…)" className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none" />

            <p className="mt-4 text-xs font-black tracking-wider text-stone-400">PAYMENT</p>
            <div className={`mt-2 grid gap-2 ${onlineProvider ? "grid-cols-3" : "grid-cols-2"}`}>
              {payModes.map((m) => (
                <button key={m} onClick={() => setForm({ ...form, pay: m })} className={`rounded-2xl border p-3 text-xs font-black transition ${form.pay === m ? "t-primary-border bg-white/10" : "border-white/10 text-stone-400"}`}>
                  {m === "COUNTER" ? "💵 Cash" : m === "UPI" ? "📱 UPI" : onlineProvider === "stripe" ? "💳 Card/Stripe" : "💳 UPI/Card"}
                </button>
              ))}
            </div>
            {!onlineProvider && <p className="mt-1.5 text-[11px] text-stone-500">Online card payment unlocks once your outlet connects its gateway — counter & UPI work now.</p>}
            {form.pay === "ONLINE" && onlineProvider && (
              <p className="mt-1.5 rounded-xl bg-emerald-500/10 p-2.5 text-[11px] font-bold text-emerald-200">⚡ Fully automatic — pay inside the secure popup and your order confirms itself. Nothing to paste, nothing to prove.</p>
            )}
            {form.pay === "UPI" && data.cafe.upiId && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="text-xs text-stone-400">Pay <b className="text-white">{inr(total, data.cafe.currency)}</b> to <b className="text-white">{data.cafe.upiId}</b></p>
                {razorAuto ? (
                  <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-200">
                    ⚡ Fully automatic — tap <b>Place order</b>, pay inside GPay/PhonePe/Paytm, and you return here with payment confirmed. Nothing to paste.
                  </p>
                ) : (
                  <>
                    {upiUrl && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          ["GPay", "G"],
                          ["PhonePe", "Pe"],
                          ["Paytm", "P"],
                        ].map(([label, mark]) => (
                          <a
                            key={label}
                            href={upiUrl}
                            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 py-3 text-center transition hover:bg-emerald-500/25 active:scale-95"
                          >
                            <span className="mx-auto grid size-8 place-items-center rounded-full bg-white text-sm font-black text-stone-900">{mark}</span>
                            <span className="mt-1 block text-[11px] font-black text-emerald-200">{label} →</span>
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-stone-500">Tap your app — amount & UPI ID come pre-filled. Pay there, come back, then tap <b>Place order</b> below.</p>
                    {upiUrl && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-bold text-stone-400">Paying from another phone? Show QR</summary>
                        <img src={`/api/qr?text=${encodeURIComponent(upiUrl)}`} alt="UPI QR" className="mx-auto mt-2 size-40 rounded-2xl bg-white p-2" />
                      </details>
                    )}
                    <p className="mt-2 rounded-xl bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-200">Paid? Just tap <b>Place order</b> below — your order fires to the kitchen instantly. The counter confirms it on their screen. No codes, no waiting. ⚡</p>
                  </>
                )}
              </div>
            )}

            <div className="mt-4 space-y-1 rounded-2xl bg-white/[.04] p-4 text-sm">
              <div className="flex justify-between text-stone-400"><span>Subtotal</span><span className="tnum">{inr(subtotal, data.cafe.currency)}</span></div>
              {discount > 0 && <div className="flex justify-between text-emerald-300"><span>Discount ({form.coupon})</span><span className="tnum">−{inr(discount, data.cafe.currency)}</span></div>}
              <div className="flex justify-between text-stone-400"><span>Tax ({data.cafe.gstPct}%)</span><span className="tnum">{inr(tax, data.cafe.currency)}</span></div>
              <div className="ticket-perf mx-1" />
              <div className="flex justify-between pt-2 text-base font-black"><span>To pay</span><span className="tnum">{inr(total, data.cafe.currency)}</span></div>
            </div>

            {err && <p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
            <button
              onClick={place}
              disabled={placing || cartLines.length === 0 || !tableCode}
              className="t-grad mt-4 w-full rounded-2xl py-4 font-black text-white shadow-xl transition hover:brightness-110 active:scale-[.99] disabled:opacity-50"
            >
              {placing ? "Sending to kitchen… 🔔"
                : form.pay === "UPI" && razorAuto ? `Pay ${inr(total, data.cafe.currency)} with UPI →`
                : form.pay === "UPI" ? `✓ I've Paid — Fire My Order • ${inr(total, data.cafe.currency)}`
                : `Place order • ${inr(total, data.cafe.currency)}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-stone-500">Hits the counter + kitchen screens in ~2 seconds 🔔</p>
          </div>
        </div>
      )}
      <footer className="mx-auto mt-10 max-w-xl px-5 pb-8 text-center text-[11px] text-stone-500">
        <span>Powered by Qtable</span>
      </footer>
      </div>
    </div>
    </ThemeStyles>
  );
}

function CategoryHead({ name, count, style }: { name: string; count: number; style: ThemeStyle }) {
  if (style === "editorial") {
    return (
      <div className="mb-3 mt-1 text-center">
        <p className="t-heading text-[11px] font-black uppercase tracking-[0.35em] opacity-60">{name}</p>
        <div className="mx-auto mt-2 h-px w-14 bg-current opacity-20" />
      </div>
    );
  }
  if (style === "tickets") {
    return (
      <div className="mb-2 flex items-center gap-2">
        <span className="t-grad grid size-6 place-items-center rounded-full text-[10px] font-black text-white">{count}</span>
        <p className="t-heading text-xs font-black uppercase tracking-[0.22em]">{name}</p>
        <span className="flex-1 border-t border-dashed border-current opacity-25" />
      </div>
    );
  }
  if (style === "poster") {
    return (
      <div className="mb-2 flex items-end justify-between">
        <p className="t-heading text-lg font-black uppercase tracking-tight">{name}</p>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black">{count}</span>
      </div>
    );
  }
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <p className="t-heading text-sm font-black uppercase tracking-wider">{name}</p>
      <span className="t-grad rounded-full px-2 py-0.5 text-[10px] font-black text-white">{count}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function DishCard({ item, currency, style, qty, lastAdded, index = 0, ordering = true, onAdd, onSub, onQuick }: {
  item: Item; currency: string; style: ThemeStyle; qty: number; lastAdded: boolean; index?: number; ordering?: boolean;
  onAdd: () => void; onSub: () => void; onQuick: () => void;
}) {
  const ownerTone = lastAdded ? "animate-pop" : "";
  const controls = !ordering ? null : qty > 0 ? (
    <div className={`t-grad flex items-center gap-2 rounded-full px-1 py-0.5 text-white shadow-lg ${ownerTone}`}>
      <button onClick={onSub} aria-label="Remove one" className="grid size-7 place-items-center rounded-full bg-black/25 text-base font-black leading-none transition active:scale-90">−</button>
      <span className="min-w-4 text-center text-[13px] font-black">{qty}</span>
      <button onClick={onAdd} aria-label="Add one" className="grid size-7 place-items-center rounded-full bg-black/25 text-base font-black leading-none transition active:scale-90">+</button>
    </div>
  ) : (
    <button onClick={onAdd} className="t-grad rounded-full px-3.5 py-1.5 text-[11px] font-black text-white shadow transition hover:brightness-110 active:scale-95">ADD +</button>
  );
  const vegDot = <span className={`grid size-3.5 shrink-0 place-items-center rounded border text-[8px] ${item.veg ? "border-green-500 text-green-500" : "border-red-500 text-red-500"}`} title={item.veg ? "Veg" : "Non-veg"}>●</span>;
  const price = inr(item.price, currency);
  const desc = item.description?.trim();

  // Menu paper — no photos, dotted price leaders, printed-menu feel.
  if (style === "editorial") {
    return (
      <div className="animate-slide-up border-b border-current/15 py-3" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
        <div className="flex items-baseline gap-2">
          <button onClick={onQuick} className="t-heading text-left text-[15px] font-black leading-snug transition hover:opacity-70">{item.name}</button>
          <span className="mb-1 min-w-3 flex-1 border-b border-dotted border-current opacity-30" />
          <span className="tnum text-sm font-black">{price}</span>
        </div>
        {desc && <p className="t-muted mt-0.5 line-clamp-1 text-[11px]">{desc}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          {vegDot}
          {item.popular && <span className="text-[10px] font-black uppercase tracking-wider opacity-60">★ Popular</span>}
          <span className="flex-1" />
          {controls}
        </div>
      </div>
    );
  }

  // Cafe board — dense thumbnail rows, easy scanning for long menus.
  if (style === "list") {
    return (
      <div className="glass t-card card-hover animate-slide-up flex items-center gap-3 p-2.5" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
        <button onClick={onQuick} className="relative size-16 shrink-0 overflow-hidden rounded-2xl" title="Quick view">
          <ItemPhoto url={item.imageUrl} emoji={item.imageEmoji} size="size-full" rounded="rounded-none" />
          {item.popular && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-black text-amber-300">★ POPULAR</span>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {vegDot}
            <button onClick={onQuick} className="truncate text-left text-sm font-black">{item.name}</button>
          </div>
          <p className="t-muted line-clamp-1 text-[11px]">{desc}</p>
          <p className="tnum mt-0.5 text-sm font-black">{price}</p>
        </div>
        <div className="shrink-0">{controls}</div>
      </div>
    );
  }

  // Ticket stubs — dashed receipt rows, street-food energy.
  if (style === "tickets") {
    return (
      <div className="animate-slide-up border border-dashed border-current/25 px-3 py-2.5" style={{ borderRadius: "calc(var(--tr) * .45)", animationDelay: `${Math.min(index, 10) * 30}ms` }}>
        <div className="flex items-baseline gap-2">
          <button onClick={onQuick} className="truncate text-left text-sm font-black uppercase tracking-wide">{item.name}</button>
          <span className="mb-1 min-w-3 flex-1 border-b border-dotted border-current opacity-25" />
          <span className="tnum text-sm font-black">{price}</span>
        </div>
        {desc && <p className="t-muted mt-0.5 line-clamp-1 text-[11px]">{desc}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          {vegDot}
          {item.popular && <span className="text-[10px] font-black uppercase tracking-wider opacity-60">★ Popular</span>}
          <span className="flex-1" />
          {controls}
        </div>
      </div>
    );
  }

  // Poster grid — photo-forward tiles with the name laid over.
  if (style === "poster") {
    return (
      <div className="t-card card-hover animate-slide-up relative overflow-hidden" style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}>
        <button onClick={onQuick} className="group relative block aspect-[3/4] w-full overflow-hidden text-left" title="Quick view">
          <span className="block size-full transition duration-300 group-hover:scale-105">
            <ItemPhoto url={item.imageUrl} emoji={item.imageEmoji} size="size-full" rounded="rounded-none" />
          </span>
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" />
          {item.popular && <span className="t-grad absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow-lg">★ POPULAR</span>}
          <span className={`absolute right-2 top-2 grid size-5 place-items-center rounded-md border bg-black/55 text-[10px] backdrop-blur ${item.veg ? "border-green-400/80 text-green-300" : "border-red-400/80 text-red-300"}`} title={item.veg ? "Veg" : "Non-veg"}>●</span>
          <span className="absolute inset-x-0 bottom-0 block p-3 text-white">
            <span className="block text-sm font-black leading-tight drop-shadow">{item.name}</span>
            <span className="tnum mt-0.5 block text-sm font-black opacity-95">{price}</span>
          </span>
        </button>
        <div className="absolute bottom-2.5 right-2.5">{controls}</div>
      </div>
    );
  }

  // Default: appetising photo cards in a 2-up grid.
  return (
    <div className="glass t-card card-hover animate-slide-up flex flex-col overflow-hidden" style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}>
      <button onClick={onQuick} className="group relative block aspect-[4/3] w-full overflow-hidden" title="Quick view">
        <span className="block size-full transition duration-300 group-hover:scale-105">
          <ItemPhoto url={item.imageUrl} emoji={item.imageEmoji} size="size-full" rounded="rounded-none" />
        </span>
        {item.popular && <span className="t-grad absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow-lg">★ Popular</span>}
        <span className={`absolute right-2 top-2 grid size-5 place-items-center rounded-md border bg-black/55 text-[10px] backdrop-blur ${item.veg ? "border-green-400/80 text-green-300" : "border-red-400/80 text-red-300"}`} title={item.veg ? "Veg" : "Non-veg"}>●</span>
      </button>
      <div className="flex flex-1 flex-col p-3">
        <button onClick={onQuick} className="t-heading truncate text-left text-sm font-black leading-snug hover:underline">{item.name}</button>
        <p className="t-muted mt-0.5 line-clamp-1 text-[11px] leading-relaxed">{item.description}</p>
        <div className="mt-auto flex items-center justify-between pt-2.5">
          <p className="tnum text-sm font-black tracking-tight">{price}</p>
          {controls}
        </div>
      </div>
    </div>
  );
}

