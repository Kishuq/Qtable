import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { rateLimit, clientKey, tooMany } from "@/lib/security";

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — menu thumbs stay fast

// Owner/staff photo upload for menu items. Validated (type + size) then
// stored in Vercel Blob; the returned https URL goes straight into imageUrl.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s?.cafeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(clientKey(req, "photo"), 20, 60_000)) return tooMany();
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Photo storage isn't connected — add BLOB_READ_WRITE_TOKEN in Vercel." }, { status: 503 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const v = form.get("photo");
    if (v instanceof File) file = v;
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "Choose a photo first" }, { status: 400 });
  const ext = ALLOWED.get(file.type);
  if (!ext) return NextResponse.json({ error: "Only JPG, PNG or WebP photos" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo must be under 2 MB" }, { status: 400 });

  try {
    const key = `menu/${s.cafeId}/${crypto.randomBytes(12).toString("hex")}.${ext}`;
    const blob = await put(key, file, { access: "public", contentType: file.type });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    console.error("BLOB_UPLOAD_FAIL", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Upload failed — try again" }, { status: 502 });
  }
}
