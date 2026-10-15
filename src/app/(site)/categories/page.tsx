import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { listCategoryTreeCached } from "@/lib/content/public";

export const metadata: Metadata = {
  title: "التصنيفات العلمية",
  description: "تصفّح المواد العلمية حسب التصنيف.",
  alternates: { canonical: "/categories" },
};

export default function CategoriesPage() {
  return (
    <PageContainer>
      <h1 className="text-3xl font-bold">التصنيفات العلمية</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">اختر تصنيفًا لعرض المواد المنشورة فيه.</p>
      <div className="mt-8">
        <Suspense fallback={<LoadingState />}>
          <CategoryList />
        </Suspense>
      </div>
    </PageContainer>
  );
}

async function CategoryList() {
  await connection(); // keep the database out of `next build`
  const tree = await listCategoryTreeCached();
  const visible = tree.filter((c) => c.count > 0);
  if (visible.length === 0) {
    return <EmptyState title="لا توجد تصنيفات تحتوي على مواد منشورة بعد" />;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((c) => (
        <li key={c.id} className="rounded-md border border-border p-5">
          <h2 className="text-lg font-bold">
            <Link href={`/categories/${encodeURIComponent(c.slug)}`} className="hover:text-accent">
              {c.name}
            </Link>
            <span className="ms-2 text-sm font-normal text-muted-foreground">({c.count})</span>
          </h2>
          {c.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
          )}
          {c.children.some((k) => k.count > 0) && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {c.children
                .filter((k) => k.count > 0)
                .map((k) => (
                  <li key={k.id}>
                    <Link
                      href={`/categories/${encodeURIComponent(k.slug)}`}
                      className="rounded-full border border-border px-3 py-1 text-sm hover:border-accent hover:text-accent"
                    >
                      {k.name} ({k.count})
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}