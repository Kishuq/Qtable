import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { limitRequest, tooMany } from "@/lib/security";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — menu thumbs stay fast

// Trust the bytes, not the browser-declared type.
function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true; // PNG
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return true; // WebP
  return false;
}

// Owner/staff photo upload for menu items.
// Uses Vercel Blob when configured; otherwise stores the image in Postgres and
// serves it through /api/public/photo/[id] — so the app needs no storage account.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await limitRequest(req, "photo", 20, 60_000))) return tooMany();

  let file: File | null = null;
  try {
    const form = await req.formData();
    const v = form.get("photo");
    if (v instanceof File) file = v;
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "Choose a photo first" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Only JPG, PNG or WebP photos" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo must be under 2 MB" }, { status: 400 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikeImage(bytes)) return NextResponse.json({ error: "That file isn't a real image" }, { status: 400 });

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const ext = ALLOWED.get(file.type)!;
      const key = `menu/${s.cafeId}/${crypto.randomBytes(12).toString("hex")}.${ext}`;
      const blob = await put(key, bytes, { access: "public", contentType: file.type });
      return NextResponse.json({ ok: true, url: blob.url });
    }

    // No storage service configured → keep the (already browser-compressed)
    // image in the outlet's own database.
    const photo = await db.menuPhoto.create({ data: { cafeId: s.cafeId, data: bytes, mime: file.type }, select: { id: true } });
    return NextResponse.json({ ok: true, url: `/api/public/photo/${photo.id}` });
  } catch (e) {
    console.error("PHOTO_UPLOAD_FAIL", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Upload failed — try again" }, { status: 502 });
  }
}
