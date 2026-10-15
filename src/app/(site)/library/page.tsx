import { Suspense } from "react";
import type { Metadata } from "next";
import { FilterPanel } from "@/components/FilterPanel";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { ResultsView } from "@/components/ResultsView";
import { hasActiveFilters, parseListFilters, type RawSearchParams } from "@/lib/content/params";
import {
  listActiveTypesCached,
  listCategoryTreeCached,
  listContentPublic,
} from "@/lib/content/public";

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseListFilters(await searchParams);
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
      <h1 className="text-3xl font-bold">المكتبة العلمية</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        جميع المواد المنشورة. ابحث بالعنوان أو الوصف أو الوسوم، أو صفِّ النتائج بالنوع والتصنيف.
      </p>
      <div className="mt-8">
        <Suspense fallback={<LoadingState />}>
          <LibraryBody searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}

async function LibraryBody({ searchParams }: Props) {
  const filters = parseListFilters(await searchParams);
  const [types, categories, result] = await Promise.all([
    listActiveTypesCached(),
    listCategoryTreeCached(),
    listContentPublic(filters),
  ]);
  return (
    <div className="space-y-8">
      <FilterPanel action="/library" filters={filters} types={types} categories={categories} />
      <ResultsView basePath="/library" filters={filters} result={result} />
    </div>
  );
}