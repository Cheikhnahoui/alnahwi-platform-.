import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterPanel } from "@/components/FilterPanel";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { ResultsView } from "@/components/ResultsView";
import { hasActiveFilters, parseListFilters, type RawSearchParams } from "@/lib/content/params";
import {
  getCategoryBySlugCached,
  listActiveTypesCached,
  listContentPublic,
} from "@/lib/content/public";
import { safeDecode } from "@/lib/format";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const slug = safeDecode((await params).slug);
  const found = await getCategoryBySlugCached(slug);
  if (!found) return { title: "التصنيف غير موجود", robots: { index: false } };
  const f = parseListFilters(await searchParams);
  return {
    title: found.category.name,
    description:
      found.category.description ?? `المواد العلمية المنشورة في تصنيف ${found.category.name}.`,
    alternates: { canonical: `/categories/${encodeURIComponent(found.category.slug)}` },
    robots: hasActiveFilters(f) || f.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default function CategoryPage(props: Props) {
  return (
    <PageContainer>
      <Suspense fallback={<LoadingState />}>
        <CategoryBody {...props} />
      </Suspense>
    </PageContainer>
  );
}

async function CategoryBody({ params, searchParams }: Props) {
  const slug = safeDecode((await params).slug);
  const filters = parseListFilters(await searchParams);
  const found = await getCategoryBySlugCached(slug);
  if (!found) notFound();
  const { category, parent } = found;
  const basePath = `/categories/${encodeURIComponent(category.slug)}`;

  const [types, result] = await Promise.all([
    listActiveTypesCached(),
    listContentPublic({ ...filters, category: category.slug }),
  ]);
  const children = category.children.filter((c) => c.count > 0);

  return (
    <>
      <nav aria-label="مسار التنقل" className="mb-6 text-sm text-muted-foreground">
        <Link href="/categories" className="underline underline-offset-4 hover:text-foreground">
          التصنيفات
        </Link>
        {parent && (
          <>
            <span aria-hidden> › </span>
            <Link
              href={`/categories/${encodeURIComponent(parent.slug)}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {parent.name}
            </Link>
          </>
        )}
      </nav>
      <h1 className="text-3xl font-bold">{category.name}</h1>
      {category.description && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{category.description}</p>
      )}

      {children.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="التصنيفات الفرعية">
          {children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/categories/${encodeURIComponent(c.slug)}`}
                className="rounded-full border border-border px-3 py-1 text-sm hover:border-accent hover:text-accent"
              >
                {c.name} ({c.count})
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 space-y-8">
        <FilterPanel action={basePath} filters={filters} types={types} />
        <ResultsView basePath={basePath} filters={filters} result={result} />
      </div>
    </>
  );
}