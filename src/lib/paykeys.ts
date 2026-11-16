import crypto from "crypto";
import { db } from "./db";
import { cfRequest, type CashfreeKeys } from "./cashfree";

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

// One-tap key check against Cashfree — proves the pasted App ID + Secret Key
// actually work before we store them. Reading an order that doesn't exist
// returns 404 for valid keys and 401/403 for bad ones, so no money is touched.
export async function verifyCashfreeKeys(appId: string, secretKey: string, live: boolean): Promise<boolean> {
  const r = await cfRequest<unknown>({ appId, secretKey, live }, "/orders/qtable-key-check");
  return r.ok || r.status === 404;
}

function envCashfree(): CashfreeKeys | null {
  const appId = (process.env.CASHFREE_APP_ID || "").trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || "").trim();
  if (!appId || !secretKey) return null;
  const flags = (process.env.CASHFREE_ENV || "").trim().toLowerCase();
  const live = flags ? flags === "production" || flags === "live" : process.env.NODE_ENV === "production";
  return { appId, secretKey, live };
}

// Resolve an outlet's gateway keys: owner-configured (DB, decrypted) first,
// deployment env fallback second. Returns null when nothing is configured.
export async function getCafeCashfree(cafeId: string): Promise<CashfreeKeys | null> {
  try {
    const cafe = await db.cafe.findUnique({
      where: { id: cafeId },
      select: { cashfreeAppId: true, cashfreeSecretEnc: true, cashfreeLive: true },
    });
    if (cafe?.cashfreeAppId && cafe.cashfreeSecretEnc) {
      try {
        return { appId: cafe.cashfreeAppId, secretKey: decryptSecret(cafe.cashfreeSecretEnc), live: cafe.cashfreeLive };
      } catch {
        // A rotated PAYMENT_SECRET makes stored secrets unreadable. Fall back to
        // env rather than throwing inside a customer's payment.
      }
    }
  } catch {
    // fall through to env
  }
  return envCashfree();
}
