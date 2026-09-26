import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_CATEGORIES, DEMO_ITEMS } from "../src/lib/demo-data";

const db = new PrismaClient();

// Single-cafe seed: ensures THE cafe exists with starter menu, tables & offers.
// Safe to re-run (backfills photos/tables/coupons). For a real cafe, use /setup instead.
async function main() {
  let cafe = await db.cafe.findFirst({ orderBy: { createdAt: "asc" } });
  if (!cafe) {
    let owner = await db.user.findUnique({ where: { email: "owner@mycafe.com" } });
    if (!owner) {
      owner = await db.user.create({
        data: { name: "Cafe Owner", email: "owner@mycafe.com", passwordHash: await bcrypt.hash("demo1234", 12), role: "OWNER" },
      });
    }
    cafe = await db.cafe.create({
      data: { name: "Brew Haven", slug: "cafe", tagline: "Scan. Order. Enjoy.", description: "Demo outlet — rename me in Settings.", upiId: "brewhaven@upi", ownerId: owner.id, gstPct: 5 },
    });
    await db.user.update({ where: { id: owner.id }, data: { cafeId: cafe.id } });
    const catMap: Record<string, string> = {};
    for (let i = 0; i < DEMO_CATEGORIES.length; i++) {
      const c = await db.category.create({ data: { cafeId: cafe.id, name: DEMO_CATEGORIES[i], sort: i } });
      catMap[c.name] = c.id;
    }
    for (let i = 0; i < DEMO_ITEMS.length; i++) {
      const it = DEMO_ITEMS[i];
      await db.menuItem.create({
        data: { cafeId: cafe.id, categoryId: catMap[it.cat], name: it.name, description: it.description, price: it.price, imageEmoji: it.imageEmoji, imageUrl: it.img, veg: it.veg, popular: it.popular, sort: i },
      });
    }
    for (let t = 1; t <= 12; t++) {
      await db.cafeTable.create({ data: { cafeId: cafe.id, code: `T${t}`, name: `Table ${t}` } });
    }
    console.log("Seeded cafe ✔ owner@mycafe.com / demo1234");
  } else {
    for (const it of DEMO_ITEMS) {
      await db.menuItem.updateMany({ where: { cafeId: cafe.id, name: it.name }, data: { imageUrl: it.img } });
    }
    console.log("Cafe exists — photos refreshed ✔");
  }
  await db.coupon.upsert({ where: { cafeId_code: { cafeId: cafe.id, code: "WELCOME10" } }, create: { cafeId: cafe.id, code: "WELCOME10", pct: 10 }, update: {} });
  await db.coupon.upsert({ where: { cafeId_code: { cafeId: cafe.id, code: "HAPPYHOUR20" } }, create: { cafeId: cafe.id, code: "HAPPYHOUR20", pct: 20 }, update: { active: true } });
}

main().finally(() => db.$disconnect());
