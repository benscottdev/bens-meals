import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { BottomNav } from "@/components/kitchen/BottomNav";
import { ServiceWorker } from "@/components/kitchen/ServiceWorker";
import "./globals.css";

const grotesk = Hanken_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["300", "400", "500"] });

export const metadata: Metadata = {
  title: "Ben's Meals",
  description: "Weekly meals, recipes and the shopping list — sorted.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ben's Meals", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#f5f2ec", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body className={`${grotesk.variable} antialiased`}>
        <main className="safe-bottom mx-auto max-w-2xl px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)]">{children}</main>
        <BottomNav />
        <ServiceWorker />
      </body>
    </html>
  );
}
