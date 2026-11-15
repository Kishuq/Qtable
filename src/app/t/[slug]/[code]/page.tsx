import { MenuApp } from "@/components/customer-menu";

// Canonical QR landing: /t/{outlet-slug}/{table-code}.
// The outlet and the table both come from the printed QR — the customer never
// picks a café and never types a table number.
//
// This shell contains no data: the menu is fetched on the client from the
// edge-cached public API. Caching the HTML is therefore safe, and it is the
// difference between "one lambda render per scan" and "one render per table per
// minute" when a dining room of people scans at the same moment. Without it
// Next marks the page dynamic (`private, no-store`) and every QR scan costs a
// function invocation.
export const revalidate = 60;

// An empty list is the documented way to say "render every path on demand,
// then cache it" — without it the route stays fully dynamic regardless of
// `revalidate`.
export function generateStaticParams() {
  return [];
}
export default async function TableMenu({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  return <MenuApp tableCode={decodeURIComponent(code)} slug={decodeURIComponent(slug)} />;
}
