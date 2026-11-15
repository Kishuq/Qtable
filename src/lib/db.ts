import { PrismaClient } from "@prisma/client";

// Serverless connection hygiene.
//
// Every Vercel instance builds its own Prisma pool. Left at the default
// (2×vCPU+1 per instance), a traffic spike spins up hundreds of instances and
// opens thousands of Postgres connections — the classic "too many clients"
// outage. These defaults keep each instance small, fail fast instead of
// hanging a request for 60s, and make the client speak the pooler's protocol
// correctly so Neon/Supabase PgBouncer does not reject prepared statements.
//
// Tune with PRISMA_CONNECTION_LIMIT if a single instance needs more.
function tunedDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  if (raw.startsWith("file:")) return raw; // SQLite dev/small install
  try {
    const u = new URL(raw);
    const set = (k: string, v: string) => {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    };
    set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT || "3");
    set("connect_timeout", "10");
    set("pool_timeout", "5");
    set("socket_timeout", "30");
    // Transaction-mode poolers (Neon `-pooler`, Supabase `:6543`) cannot keep
    // prepared statements across queries. `pgbouncer=true` switches Prisma to
    // the compatible protocol; on a direct host it is simply not applied.
    if (/-pooler\./i.test(u.hostname)) set("pgbouncer", "true");
    return u.toString();
  } catch {
    return raw; // non-URL DSN: leave it exactly as the operator wrote it
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: tunedDatabaseUrl(process.env.DATABASE_URL) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// SQLite concurrency hardening (dev/small deployments):
// WAL lets reads proceed during writes; busy_timeout makes writers queue
// instead of instantly failing with SQLITE_BUSY during order rushes.
// Postgres ignores these (it has real MVCC + pooling via Prisma).
if ((process.env.DATABASE_URL || "").startsWith("file:")) {
  void db.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});
  void db.$executeRawUnsafe("PRAGMA busy_timeout=8000;").catch(() => {});
  void db.$executeRawUnsafe("PRAGMA synchronous=NORMAL;").catch(() => {});
}

// Transient failures that are safe to retry for READS: a paused/cold Neon
// compute or a pooler connection reset. A couple of quick retries turn a
// one-second database blip into a normal response instead of a 500 on a
// customer's phone.
const RETRYABLE_DB_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // database server timed out
  "P1008", // operation timed out
  "P1010", // user access denied (pooler waking up)
  "P1017", // server closed the connection
  "P2034", // write conflict or deadlock
]);

// P2024 (pool checkout timeout) is deliberately NOT retried: the pool is
// saturated, so retrying triples the wait and makes the outage worse. The
// caller should shed load fast, which pool_timeout=5s guarantees.

/**
 * Retries a database operation on transient connectivity errors.
 *
 * Only use this around idempotent work (reads, or writes protected by a unique
 * constraint). Writes without such a guard are deliberately not retried: a
 * lost connection can mean "committed but the reply never arrived".
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  label = "db",
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const code = String((e as { code?: unknown })?.code ?? "");
      if (!RETRYABLE_DB_CODES.has(code) || attempt === attempts - 1) throw e;
      const wait = 40 * 2 ** attempt + Math.floor(Math.random() * 60);
      console.warn(`DB_RETRY ${label} code=${code} attempt=${attempt + 1} wait=${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastError;
}
