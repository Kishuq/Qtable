import { notFound, redirect } from "next/navigation";
import { MenuApp } from "@/components/customer-menu";
import { getCafeBySlug, getDefaultCafe } from "@/lib/cafe";
import { db } from "@/lib/db";

// One segment under /t/ is ambiguous: it can be a legacy table code (/t/T1,
// printed before multi-tenant) or an outlet slug typed by hand (/t/cafe).
//
//   • A real outlet slug opens a BROWSE-ONLY menu. It must never become an
//     ordering link — ordering is QR-only, so the table comes from the printed
//     card (/t/{slug}/{table}) and nowhere else.
//   • Anything else is treated as a legacy table code on the oldest outlet,
//     but only when that table actually exists. Unknown codes 404 instead of
//     silently landing on a menu that fails at checkout.
//
// Printed cards never need to be reprinted.
export const revalidate = 60;

// Every path renders on demand, then caches — same reasoning as the table page.
export function generateStaticParams() {
  return [];
}

export default async function OutletOrLegacyTable({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const value = decodeURIComponent(slug);

  const cafe = await getCafeBySlug(value);
  if (cafe) return <MenuApp tableCode={null} slug={cafe.slug} />;

  const fallback = await getDefaultCafe();
  if (!fallback) notFound();

  const table = await db.cafeTable.findFirst({
    where: { cafeId: fallback.id, code: value, active: true },
    select: { code: true },
  });
  if (!table) notFound();

  redirect(`/t/${encodeURIComponent(fallback.slug)}/${encodeURIComponent(table.code)}`);
}
