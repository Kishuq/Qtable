import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

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
