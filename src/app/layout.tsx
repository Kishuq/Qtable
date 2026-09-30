import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ux";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Qtable — The Digital Operating System for Modern Food Businesses",
  description: "Transform your restaurant, cafe or food business with QR ordering, digital menus, real-time kitchen management, tables, inventory and analytics — all in one platform.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Qtable" },
  openGraph: {
    title: "Qtable — The Digital Operating System for Modern Food Businesses",
    description: "Turn every table into a smarter ordering experience. Scan. Order. Flow.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0c0a09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-50"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
