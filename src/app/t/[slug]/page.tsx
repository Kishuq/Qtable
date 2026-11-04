import { redirect } from "next/navigation";
import { getCafeBySlug, getDefaultCafe } from "@/lib/cafe";
import { db } from "@/lib/db";

// One segment under /t/ is ambiguous: it can be a legacy table code (/t/T1,
// printed before multi-tenant) or an outlet slug typed by hand (/t/cafe).
// A real outlet slug resolves to that outlet's first table so the link still
// lands on a working menu; anything else is treated as a legacy table code on
// the oldest outlet. Printed cards never need to be reprinted.
export default async function LegacyTableMenu({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const value = decodeURIComponent(slug);

  const cafe = (await getCafeBySlug(value)) || (await getDefaultCafe());
  if (!cafe) redirect("/");

  // If the segment was an outlet slug, land on its first table.
  let code = value;
  if (cafe.slug === value.toLowerCase()) {
    const first = await db.cafeTable.findFirst({
      where: { cafeId: cafe.id, active: true },
      orderBy: { code: "asc" },
      select: { code: true },
    });
    code = first?.code || "T1";
  }

  redirect(`/t/${encodeURIComponent(cafe.slug)}/${encodeURIComponent(code)}`);
}
