import { Suspense } from "react";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { StaticPageView, staticPageMetadata } from "@/components/StaticPageView";

export function generateMetadata() {
  return staticPageMetadata("terms", "شروط الاستخدام");
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
      <StaticPageView pageKey="terms" fallbackTitle="شروط الاستخدام" />
    </Suspense>
  );
}