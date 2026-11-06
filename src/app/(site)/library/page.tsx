import { Suspense } from "react";
import type { Metadata } from "next";
import { FilterPanel } from "@/components/FilterPanel";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { EmptyState } from "@/components/EmptyState";
import { ResultsView } from "@/components/ResultsView";
import { FullPosts } from "@/components/FullPosts";
import { hasActiveFilters, parseListFilters, type RawSearchParams } from "@/lib/content/params";
import {
  listActiveTypesCached,
  listCategoryTreeCached,
  listContentPublic,
  listPublishedWithTextCached,
} from "@/lib/content/public";

type Props = { searchParams: Promise<RawSearchParams> };

/** These types are one long page of full posts, with no search or filters. */
const FULL_TEXT_TYPES = new Map([
  ["khawatir", { title: "خواطر", empty: "لا توجد خواطر منشورة بعد" }],
  ["poem", { title: "قصائد الشيخ", empty: "لا توجد قصائد منشورة بعد" }],
]);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseListFilters(await searchParams);
  const fullText = FULL_TEXT_TYPES.get(f.type);
  if (fullText) {
    return {
      title: fullText.title,
      alternates: { canonical: `/library?type=${f.type}` },
    };
  }
  return {
    title: "المكتبة العلمية",
    description: "تصفّح المواد العلمية المنشورة بالبحث والتصنيف ونوع المادة.",
    alternates: { canonical: "/library" },
    // Search/filter/page variants are for visitors, not for search engines.
    robots: hasActiveFilters(f) || f.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default function LibraryPage({ searchParams }: Props) {
  return (
    <PageContainer>
      <Suspense fallback={<LoadingState />}>
        <LibraryBody searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function LibraryBody({ searchParams }: Props) {
  const filters = parseListFilters(await searchParams);
  const fullText = FULL_TEXT_TYPES.get(filters.type);
  if (fullText) return <FullTextList typeKey={filters.type} {...fullText} />;

  const [types, categories, result] = await Promise.all([
    listActiveTypesCached(),
    listCategoryTreeCached(),
    listContentPublic(filters),
  ]);
  return (
    <>
      <h1 className="text-3xl font-bold">المكتبة العلمية</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        جميع المواد المنشورة. ابحث بالعنوان أو الوصف أو الوسوم، أو صفِّ النتائج بالنوع والتصنيف.
      </p>
      <div className="mt-8 space-y-8">
        <FilterPanel action="/library" filters={filters} types={types} categories={categories} />
        <ResultsView basePath="/library" filters={filters} result={result} />
      </div>
    </>
  );
}

async function FullTextList({
  typeKey,
  title,
  empty,
}: {
  typeKey: string;
  title: string;
  empty: string;
}) {
  // Everything on one page: URL parameters (q, category, sort, page) are ignored on purpose.
  const items = await listPublishedWithTextCached(typeKey);
  return (
    <>
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="mt-8">
        {items.length === 0 ? <EmptyState title={empty} /> : <FullPosts items={items} />}
      </div>
    </>
  );
}
