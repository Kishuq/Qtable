import { MenuApp } from "@/components/customer-menu";

// Customer menu — pure menu experience, no picker, no logins.
export default function Home() {
  return <MenuApp tableCode={null} />;
}
