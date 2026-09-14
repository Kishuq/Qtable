import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ux";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QRServe — QR ordering for your cafe",
  description: "Scan the table QR, order & pay. The counter and kitchen get every order live with sound.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "QRServe" },
};

export const viewport: Viewport = { themeColor: "#0c0a09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-50"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
