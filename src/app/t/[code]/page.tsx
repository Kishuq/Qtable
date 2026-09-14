"use client";
import { use } from "react";
import { MenuApp } from "@/components/customer-menu";

// QR landing: /t/T1 — table comes from the QR, customer only ever sees the menu.
export default function TableMenu({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <MenuApp tableCode={decodeURIComponent(code)} />;
}
