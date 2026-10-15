"use client";

import { ErrorState } from "@/components/ErrorState";
import { PageContainer } from "@/components/PageContainer";

export default function SiteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer narrow>
      <ErrorState onRetry={reset} />
    </PageContainer>
  );
}