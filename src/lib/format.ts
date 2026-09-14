// Locale picked per currency so $1,234.00 / ₹1,234.00 / €1.234,00 all render natively.
const LOCALES: Record<string, string> = {
  INR: "en-IN", USD: "en-US", EUR: "de-DE", GBP: "en-GB",
  AED: "en-AE", SAR: "ar-SA", CAD: "en-CA", AUD: "en-AU", SGD: "en-SG", JPY: "ja-JP",
};

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "JPY"];

export function money(paise: number, currency = "INR") {
  const v = (paise || 0) / 100;
  try {
    return new Intl.NumberFormat(LOCALES[currency] || "en-US", { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

// Kept so existing imports keep working.
export const inr = money;

// Viewer-locale dates: a US owner sees US formats, an Indian owner sees Indian.
export function fdate(d: string | Date, opts?: Intl.DateTimeFormatOptions) {
  try {
    return new Date(d).toLocaleString(undefined, opts);
  } catch {
    return new Date(d).toLocaleString();
  }
}

export function timeAgo(d: string | Date) {
  const t = new Date(d).getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fdate(d);
}

export function upiLink(upiId: string, name: string, amountRupees: number, note: string) {
  const p = new URLSearchParams({ pa: upiId, pn: name.slice(0, 40), am: amountRupees.toFixed(2), cu: "INR", tn: note.slice(0, 60) });
  return `upi://pay?${p.toString()}`;
}
