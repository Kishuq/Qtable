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
      const timer = setInterval(async () => {
        try {
          const latest = await db.order.findFirst({ where: { cafeId }, orderBy: { updatedAt: "desc" }, select: { id: true, updatedAt: true } });
          const open = await db.order.count({ where: { cafeId, status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] } } });
          const key = `${latest?.id}:${latest?.updatedAt?.getTime()}:${open}`;
          if (key !== lastSent) {
            lastSent = key;
            send(JSON.stringify({ tick: Date.now(), open, latestId: latest?.id || null }));
          } else {
            controller.enqueue(enc.encode(`: ping\n\n`));
          }
        } catch { /* keep alive */ }
      }, 2500);
      req.signal.addEventListener("abort", () => clearInterval(timer));
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
