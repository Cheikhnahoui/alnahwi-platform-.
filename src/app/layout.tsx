import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_NAME = "الموقع الرسمي للشيخ عبد الرحمن النحوي";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "الشيخ عبد الرحمن النحوي | الموقع الرسمي",
    template: `%s | الشيخ عبد الرحمن النحوي`,
  },
  description:
    "الموقع الرسمي للشيخ عبد الرحمن النحوي (عبدالرحمن النحوي): مكتبة علمية رقمية تجمع المحاضرات والدروس والمواد الصوتية والبحوث والمقالات والقصائد المتاحة، مع العناية بالمصادر وحقوق النشر.",
  alternates: { canonical: "/" },
  openGraph: {
    siteName: SITE_NAME,
    locale: "ar",
    type: "website",
    url: "/",
    title: "الشيخ عبد الرحمن النحوي | الموقع الرسمي",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
