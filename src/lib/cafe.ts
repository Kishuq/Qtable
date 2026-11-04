import { db } from "./db";

// Multi-outlet resolution. Public links carry the outlet slug
// (/t/{slug}/{table}); legacy links without a slug still resolve to the
// oldest outlet so QR cards printed before multi-tenant keep working.
export const RESERVED_SLUGS = new Set([
  "api", "dashboard", "login", "setup", "subscribe", "privacy", "terms", "t",
  "order", "forgot-password", "reset-password", "manifest.webmanifest",
  "robots.txt", "sitemap.xml", "favicon.ico", "_next", "www", "app", "admin",
]);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// "Blue Tokai" -> "blue-tokai"; collisions get -2, -3, … so two owners can
// share a name without stepping on each other's QR links.
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "outlet";
  let candidate = RESERVED_SLUGS.has(base) ? `${base}-outlet` : base;
  for (let n = 2; n < 100; n++) {
    const taken = await db.cafe.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function getCafeBySlug(slug: string) {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  return db.cafe.findUnique({ where: { slug: s } });
}

export async function getCafeById(id: string) {
  return db.cafe.findUnique({ where: { id } });
}

export async function getDefaultCafe() {
  return db.cafe.findFirst({ orderBy: { createdAt: "asc" } });
}

// No slug → oldest outlet (legacy /t/T1 links, single-outlet deployments).
export async function resolveCafe(slug?: string | null) {
  if (slug && slug.trim()) return getCafeBySlug(slug);
  return getDefaultCafe();
}

export async function requireCafe(slug?: string | null) {
  const cafe = await resolveCafe(slug);
  if (!cafe) throw new Error("NO_CAFE");
  return cafe;
}
