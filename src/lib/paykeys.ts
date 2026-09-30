import crypto from "crypto";
import { db } from "./db";

// Per-outlet gateway secrets, AES-256-GCM encrypted at rest.
// Key comes from PAYMENT_SECRET (set it in Vercel), falling back to JWT_SECRET
// so self-hosted dev never breaks — production should always set PAYMENT_SECRET.
function encKey(): Buffer {
  const raw = process.env.PAYMENT_SECRET || process.env.JWT_SECRET || "dev-only-payment-key";
  return crypto.createHash("sha256").update(`qtable-pay:${raw}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(packed: string): string {
  const [ivH, tagH, dataH] = (packed || "").split(":");
  if (!ivH || !tagH || !dataH) throw new Error("bad secret payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivH, "hex"));
  decipher.setAuthTag(Buffer.from(tagH, "hex"));
  return decipher.update(Buffer.from(dataH, "hex")) + decipher.final("utf8");
}

// One-tap key check against Razorpay — proves the pasted keys actually work
// before we store them (works in test mode too, so owners verify instantly).
export async function verifyRazorpayKeys(keyId: string, keySecret: string): Promise<boolean> {
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders?count=1", {
      headers: { Authorization: `Basic ${auth}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Resolve a cafe's gateway keys: owner-configured (DB, decrypted) first,
// deployment env fallback second. Returns null when nothing is configured.
export async function getCafeRazorpay(cafeId: string): Promise<{ keyId: string; keySecret: string; live: boolean } | null> {
  try {
    const cafe = await db.cafe.findUnique({ where: { id: cafeId } });
    if (cafe?.razorpayKeyId && cafe.razorpayKeySecretEnc) {
      return { keyId: cafe.razorpayKeyId, keySecret: decryptSecret(cafe.razorpayKeySecretEnc), live: cafe.razorpayLive };
    }
  } catch {
    // fall through to env
  }
  const id = process.env.RAZORPAY_KEY_ID || "";
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  if (id && secret) return { keyId: id, keySecret: secret, live: id.startsWith("rzp_live") };
  return null;
}
