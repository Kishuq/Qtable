import QRCode from "qrcode";

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 512, margin: 2, errorCorrectionLevel: "M" });
}

export function tableUrl(appUrl: string, code: string) {
  return `${appUrl.replace(/\/$/, "")}/t/${encodeURIComponent(code)}`;
}
