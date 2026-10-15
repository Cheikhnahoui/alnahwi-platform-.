import { Suspense } from "react";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { StaticPageView, staticPageMetadata } from "@/components/StaticPageView";

export function generateMetadata() {
  return staticPageMetadata("copyright_policy", "سياسة حقوق النشر وإعادة استخدام المواد");
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <PageContainer narrow>
          <LoadingState cards={1} />
        </PageContainer>
      }
    >
      <StaticPageView
        pageKey="copyright_policy"
        fallbackTitle="سياسة حقوق النشر وإعادة استخدام المواد"
      />
    </Suspense>
  );
}