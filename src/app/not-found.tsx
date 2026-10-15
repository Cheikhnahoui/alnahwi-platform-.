import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "الصفحة غير موجودة", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <PageContainer narrow>
          <EmptyState
            title="الصفحة غير موجودة"
            description="ربما تغيّر الرابط أو لم تعد المادة منشورة."
            action={{ href: "/library", label: "تصفّح المكتبة" }}
          />
        </PageContainer>
      </main>
      <SiteFooter pageLinks={[]} />
    </>
  );
}