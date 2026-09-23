import { MenuApp } from "@/components/customer-menu";

// Generic menu (no table) — browse only. Ordering needs a table QR (/t/T1)
// which auto-detects the table.
export default function MenuPage() {
  return <MenuApp tableCode={null} />;
}
