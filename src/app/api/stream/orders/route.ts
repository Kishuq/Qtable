import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Realtime order stream for owner screens (counter + mobile + kitchen).
// Client: new EventSource(`/api/stream/orders?cafeId=...`)
// NOTE (production/serverless): hosts like Vercel cap function lifetime, so the
// client treats SSE as an enhancement — 5s polling is the reliable backbone.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return new Response("unauthorized", { status: 401 });
  const cafeId = req.nextUrl.searchParams.get("cafeId") || s.cafeId;
  if (cafeId !== s.cafeId) return new Response("forbidden", { status: 403 });

  let lastSent = "";
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: string) => {
        try { controller.enqueue(enc.encode(`data: ${data}\n\n`)); } catch { /* closed */ }
      };
      send(JSON.stringify({ hello: true, at: Date.now() }));
      // 10s heartbeat, not 2.5s. A change only needs to reach the counter within
      // a few seconds; polling the DB four times faster multiplied every open
      // dashboard by 4 for no perceptible benefit. Three cheap indexed queries
      // per outlet per tick, and the client falls back to its own poll anyway.
      const timer = setInterval(async () => {
        try {
          const [latest, open, waiter] = await Promise.all([
            db.order.findFirst({ where: { cafeId }, orderBy: { updatedAt: "desc" }, select: { id: true, updatedAt: true } }),
            db.order.count({ where: { cafeId, status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } } }),
            db.serviceCall.findFirst({ where: { cafeId, status: "OPEN" }, orderBy: { createdAt: "desc" }, select: { id: true } }),
          ]);
          const key = `${latest?.id}:${latest?.updatedAt?.getTime()}:${open}:${waiter?.id || ""}`;
          if (key !== lastSent) {
            lastSent = key;
            send(JSON.stringify({ tick: Date.now(), open, latestId: latest?.id || null, waiterId: waiter?.id || null }));
          } else {
            controller.enqueue(enc.encode(`: ping\n\n`));
          }
        } catch { /* keep alive */ }
      }, 10_000);
      req.signal.addEventListener("abort", () => clearInterval(timer));
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
