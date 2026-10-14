import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_NAME = "الموقع الرسمي للشيخ عبد الرحمن النحوي";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "مكتبة علمية رقمية تجمع المواد العلمية المتاحة وتنظمها.",
  openGraph: { siteName: SITE_NAME, locale: "ar", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
