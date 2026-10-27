import { Suspense } from "react";
import type { Metadata } from "next";
import { FilterPanel } from "@/components/FilterPanel";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";
import { ResultsView } from "@/components/ResultsView";
import { TitleList } from "@/components/TitleList";
import { hasActiveFilters, parseListFilters, type RawSearchParams } from "@/lib/content/params";
import {
  listActiveTypesCached,
  listCategoryTreeCached,
  listContentPublic,
} from "@/lib/content/public";

type Props = { searchParams: Promise<RawSearchParams> };

/** Khawatir is shown as a plain list of titles, with no search or filters. */
const KHAWATIR = "khawatir";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseListFilters(await searchParams);
  if (f.type === KHAWATIR) {
    return {
      title: "خواطر",
      alternates: { canonical: `/library?type=${KHAWATIR}` },
      robots: f.page > 1 ? { index: false, follow: true } : undefined,
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
  if (filters.type === KHAWATIR) return <KhawatirList page={filters.page} />;

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

async function KhawatirList({ page }: { page: number }) {
  // Only the page number is honoured; q/category/sort from the URL are ignored on purpose.
  const filters = { q: "", type: KHAWATIR, category: "", sort: "newest" as const, page };
  const { items, total, pageSize } = await listContentPublic(filters);
  return (
    <>
      <h1 className="text-3xl font-bold">خواطر</h1>
      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState title="لا توجد خواطر منشورة بعد" />
        ) : (
          <>
            <TitleList items={items} />
            <Pagination basePath="/library" filters={filters} total={total} pageSize={pageSize} />
          </>
        )}
      </div>
    </>
  );
}
