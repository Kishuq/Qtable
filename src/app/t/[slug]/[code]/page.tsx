import { MenuApp } from "@/components/customer-menu";

// Canonical QR landing: /t/{outlet-slug}/{table-code}.
// The outlet and the table both come from the printed QR — the customer never
// picks a café and never types a table number.
export default async function TableMenu({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  return <MenuApp tableCode={decodeURIComponent(code)} slug={decodeURIComponent(slug)} />;
}
