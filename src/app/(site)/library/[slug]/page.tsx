import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetailView } from "@/components/ContentDetailView";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { getContentBySlugCached } from "@/lib/content/public";
import { safeDecode } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = safeDecode((await params).slug);
  const item = await getContentBySlugCached(slug);
  if (!item) return { title: "المادة غير موجودة", robots: { index: false } };
  const url = `/library/${encodeURIComponent(item.slug)}`;
  const description = item.summary ?? undefined;
  return {
    title: item.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title: item.title, description, url, locale: "ar" },
  };
}

export default function ItemPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <PageContainer narrow>
          <LoadingState cards={1} />
        </PageContainer>
      }
    >
      <ItemView params={params} />
    </Suspense>
  );
}

async function ItemView({ params }: Props) {
  const slug = safeDecode((await params).slug);
  const item = await getContentBySlugCached(slug);
  if (!item) notFound();
  return (
    <PageContainer narrow>
      <ContentDetailView item={item} />
    </PageContainer>
  );
}
