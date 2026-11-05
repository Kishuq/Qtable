"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type NewOrderInfo = {
  id: string; tokenNo: number; tableCode: string; customerName: string;
  total: number; items: { name: string; qty: number }[];
};

// ---- Synthesized cafe bell (no audio files needed, works offline) ----
function ringBell(ctx: AudioContext, delay = 0) {
  const t = ctx.currentTime + delay;
  // Bright two-tone chime: strike + shimmer harmonics
  [[987.77, 0.4, 0], [1318.5, 0.3, 0.02], [1975.5, 0.15, 0.04]].forEach(([freq, vol, off]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t + off);
    g.gain.exponentialRampToValueAtTime(vol, t + off + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + off + 1.1);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t + off);
    osc.stop(t + off + 1.2);
  });
}

function chimeTwice(ctx: AudioContext) {
  ringBell(ctx, 0);
  ringBell(ctx, 0.45);
}

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem("qrserve_seen_orders") || "[]"));
  } catch { return new Set(); }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem("qrserve_seen_orders", JSON.stringify([...seen].slice(-60)));
  } catch { /* private mode */ }
}

// Watches for NEW orders: loud chime + browser notification + vibration.
// Browsers block audio until the user taps once — we surface that via audioLocked.
export type WaiterInfo = { id: string; tableCode: string };

export function useLiveOrders(
  cafeId: string | null,
  onNew?: (o: NewOrderInfo) => void,
  onWaiter?: (w: WaiterInfo) => void
) {
  const [open, setOpen] = useState(0);
  const [connected, setConnected] = useState(false);
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem("qrserve_sound") !== "off"; } catch { return true; }
  });
  const [audioLocked, setAudioLocked] = useState(true);
  const [notifPerm, setNotifPerm] = useState<string>(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));

  const ctxRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const seenWaiterRef = useRef<Set<string> | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  const onWaiterRef = useRef(onWaiter);
  onWaiterRef.current = onWaiter;

  const ensureAudio = useCallback((): AudioContext | null => {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") void ctx.resume().then(() => {
        if (ctxRef.current?.state === "running") setAudioLocked(false);
      });
      if (ctx.state === "running") setAudioLocked(false);
      return ctx;
    } catch { return null; }
  }, []);

  // Browsers demand a user gesture before any sound — capture the first tap.
  useEffect(() => {
    const unlock = () => ensureAudio();
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, [ensureAudio]);

  const alert = useCallback((order: NewOrderInfo) => {
    if (soundRef.current) {
      const ctx = ensureAudio();
      if (ctx && ctx.state === "running") chimeTwice(ctx);
    }
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* noop */ }
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(`🔔 New order #${order.tokenNo} — Table ${order.tableCode}`, {
          body: `${order.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} • ₹${(order.total / 100).toFixed(2)}`,
          tag: order.id,
        });
        n.onclick = () => { window.focus(); window.location.href = "/dashboard/orders"; };
      }
    } catch { /* noop */ }
    onNewRef.current?.(order);
  }, [ensureAudio]);

  const alertWaiter = useCallback((w: WaiterInfo) => {
    if (soundRef.current) {
      const ctx = ensureAudio();
      // Triple chime for waiter calls — distinct from the order bell.
      if (ctx && ctx.state === "running") { ringBell(ctx, 0); ringBell(ctx, 0.3); ringBell(ctx, 0.6); }
    }
    try { if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]); } catch { /* noop */ }
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification(`🛎️ Table ${w.tableCode} needs assistance`, {
          body: "A customer tapped Call Waiter — please attend.",
          tag: w.id,
        });
        n.onclick = () => { window.focus(); window.location.href = "/dashboard/orders"; };
      }
    } catch { /* noop */ }
    onWaiterRef.current?.(w);
  }, [ensureAudio]);

  const check = useCallback(async () => {
    if (!cafeId) return;
    // One request carries both NEW orders and open waiter calls, so a counter
    // with three tabs open makes one poll instead of six.
    try {
      const r = await fetch("/api/orders?status=NEW&live=1");
      if (!r.ok) return;
      const j = await r.json();

      const fresh: NewOrderInfo[] = j.orders || [];
      setOpen(fresh.length);
      if (!seenRef.current) {
        seenRef.current = loadSeen();
        // First check seeds the baseline silently — no alarm storm on page load.
        fresh.forEach((o) => seenRef.current!.add(o.id));
        saveSeen(seenRef.current);
      } else {
        for (const o of fresh) {
          if (!seenRef.current.has(o.id)) {
            seenRef.current.add(o.id);
            alert(o);
          }
        }
        saveSeen(seenRef.current);
      }

      if (!Array.isArray(j.waiterCalls)) return;
      const calls: WaiterInfo[] = j.waiterCalls.filter((c: { status: string }) => c.status === "OPEN");
      if (!seenWaiterRef.current) {
        seenWaiterRef.current = new Set(calls.map((w) => w.id));
        return;
      }
      for (const w of calls) {
        if (!seenWaiterRef.current.has(w.id)) {
          seenWaiterRef.current.add(w.id);
          alertWaiter(w);
        }
      }
    } catch { /* offline — SSE/poll will retry */ }
  }, [cafeId, alert, alertWaiter]);

  useEffect(() => {
    if (!cafeId) return;
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let pollMs = 0;
    // SSE already pings us the moment something changes. While it's healthy a
    // slow 30s safety poll is enough; if the stream drops (serverless 60s cap,
    // sleeping laptop) we fall back to 10s polling until it reconnects.
    const arm = (ms: number) => {
      if (pollMs === ms && poll) return;
      pollMs = ms;
      if (poll) clearInterval(poll);
      poll = setInterval(() => { if (!document.hidden) void check(); }, ms);
    };
    try {
      es = new EventSource(`/api/stream/orders?cafeId=${cafeId}`);
      es.onopen = () => { setConnected(true); arm(30_000); };
      es.onmessage = () => { setConnected(true); arm(30_000); void check(); };
      es.onerror = () => { setConnected(false); arm(10_000); };
    } catch { /* polling fallback below */ }
    void check();
    arm(10_000);
    return () => { es?.close(); if (poll) clearInterval(poll); };
  }, [cafeId, check]);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      try { localStorage.setItem("qrserve_sound", next ? "on" : "off"); } catch { /* noop */ }
      if (next) {
        ensureAudio();
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "default") {
            void Notification.requestPermission().then((p) => setNotifPerm(p));
          }
        } catch { /* noop */ }
      }
      return next;
    });
  }, [ensureAudio]);

  const testAlarm = useCallback(() => {
    const ctx = ensureAudio();
    if (ctx && ctx.state === "running") chimeTwice(ctx);
    else setAudioLocked(true);
    try {
      if (typeof Notification !== "undefined") {
        if (Notification.permission === "default") void Notification.requestPermission().then((p) => setNotifPerm(p));
        else if (Notification.permission === "granted") new Notification("🔔 Qtable alarm test", { body: "Sounds on! New orders will ring like this." });
      }
    } catch { /* noop */ }
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* noop */ }
  }, [ensureAudio]);

  return { open, connected, soundOn, toggleSound, testAlarm, audioLocked, notifPerm };
}
