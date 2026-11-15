import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";

// Public menu photo stored in the database (no Blob/S3 account needed).
// URLs are unique per upload and never change, so they are served with a
// one-year immutable cache: in production the CDN answers almost every request
// and the database is read once per photo, not once per customer.
//
// A cache MISS that many people hit at once is the dangerous case — a room full
// of customers scanning while the CDN entry is cold would otherwise open one
// blob query per phone and exhaust the connection pool, so images would 503.
// The per-instance byte cache plus in-flight coalescing below turns that
// stampede into a single query. `stale-if-error` keeps an already-seen photo
// visible if the database is briefly unreachable during a refresh.
const MICRO_MS = 10 * 60_000;
const MAX_ENTRIES = 120;
const MAX_BYTES = 24 * 1024 * 1024;

const cache = new Map<string, { body: Uint8Array<ArrayBuffer>; mime: string; at: number }>();
const inFlight = new Map<string, Promise<Load>>();
let cachedBytes = 0;

type Load = { kind: "ok"; body: Uint8Array<ArrayBuffer>; mime: string } | { kind: "missing" } | { kind: "error" };

function remember(id: string, body: Uint8Array<ArrayBuffer>, mime: string) {
  const previous = cache.get(id);
  if (previous) {
    cachedBytes -= previous.body.byteLength;
    cache.delete(id);
  }
  // Evict oldest until both the entry count and byte budget fit again.
  while (cache.size && (cache.size >= MAX_ENTRIES || cachedBytes + body.byteLength > MAX_BYTES)) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    const entry = cache.get(oldest);
    if (entry) cachedBytes -= entry.body.byteLength;
    cache.delete(oldest);
  }
  cache.set(id, { body, mime, at: Date.now() });
  cachedBytes += body.byteLength;
}

const PHOTO_CACHE = "public, max-age=31536000, immutable, stale-if-error=604800";

async function loadPhoto(id: string): Promise<Load> {
  try {
    const photo = await withDbRetry(
      () => db.menuPhoto.findUnique({ where: { id }, select: { data: true, mime: true } }),
      "public-photo",
      2,
    );
    if (!photo) return { kind: "missing" };
    // Copy out of the driver's Buffer so the cached bytes are a plain
    // ArrayBuffer-backed view (the shape Response accepts as a body).
    const own = new ArrayBuffer(photo.data.byteLength);
    new Uint8Array(own).set(photo.data);
    return { kind: "ok", body: new Uint8Array(own), mime: photo.mime };
  } catch (e) {
    console.error("PUBLIC_PHOTO_DB_FAIL", e instanceof Error ? e.message : e);
    return { kind: "error" };
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < MICRO_MS) {
    return new NextResponse(hit.body, {
      headers: {
        "Content-Type": hit.mime,
        "Content-Length": String(hit.body.byteLength),
        "Cache-Control": PHOTO_CACHE,
        "X-Content-Type-Options": "nosniff",
        "X-Qtable-Cache": "hit",
      },
    });
  }

  let pending = inFlight.get(id);
  if (!pending) {
    pending = loadPhoto(id).finally(() => inFlight.delete(id));
    inFlight.set(id, pending);
  }
  const photo = await pending;

  if (photo.kind === "ok") {
    remember(id, photo.body, photo.mime);
    return new NextResponse(photo.body, {
      headers: {
        "Content-Type": photo.mime,
        "Content-Length": String(photo.body.byteLength),
        "Cache-Control": PHOTO_CACHE,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (photo.kind === "missing") {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "public, s-maxage=60" },
    });
  }

  // Do not turn a database blip into a 404: the browser would cache "gone".
  return new NextResponse("Photo temporarily unavailable", {
    status: 503,
    headers: { "Retry-After": "5", "Cache-Control": "no-store" },
  });
}
