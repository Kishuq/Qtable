import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

// ✅ Allow only printable ASCII characters (no control codes, no script tags, no newlines)
// Maximum 500 chars — long text produces huge QRs that may not scan well.
function sanitizeQrText(text: string): string {
  // Keep letters, digits, spaces, and basic punctuation; strip everything else
  return text.replace(/[^\x20-\x7E]/g, "").slice(0, 500);
}

// GET /api/qr?text=... — server-side QR PNG (used for printable table QRs)
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("text") || "";
  const text = sanitizeQrText(raw);
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  try {
    const buf = await QRCode.toBuffer(text, { width: 640, margin: 2, errorCorrectionLevel: "M" });
    const body = new Uint8Array(buf);
    return new NextResponse(body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch {
    return NextResponse.json({ error: "QR failed" }, { status: 500 });
  }
}
