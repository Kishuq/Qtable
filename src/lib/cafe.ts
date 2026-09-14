import { db } from "./db";

// Single-cafe mode: the app serves exactly one cafe — the first one created.
export async function getCafe() {
  return db.cafe.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function requireCafe() {
  const cafe = await getCafe();
  if (!cafe) throw new Error("NO_CAFE");
  return cafe;
}
