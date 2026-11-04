import QRCode from "qrcode";

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 512, margin: 2, errorCorrectionLevel: "M" });
}

// Canonical table URL. Slug is required in multi-tenant; the optional form is
// kept for callers that still build links before the outlet is known.
export function tableUrl(appUrl: string, code: string, slug?: string) {
  const base = appUrl.replace(/\/$/, "");
  return slug
    ? `${base}/t/${encodeURIComponent(slug)}/${encodeURIComponent(code)}`
    : `${base}/t/${encodeURIComponent(code)}`;
}
