import type { Metadata } from "next";
import { connection } from "next/server";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { getPublishedPageCached } from "@/lib/content/public";
import { formatDate, toParagraphs } from "@/lib/format";

/** Metadata for a managed page: indexable only once it is published with content. */
export async function staticPageMetadata(key: string, fallbackTitle: string): Promise<Metadata> {
  await connection();
  const page = await getPublishedPageCached(key).catch(() => null);
  return page
    ? { title: page.title }
    : { title: fallbackTitle, robots: { index: false, follow: false } };
}

/** Body is rendered as plain paragraphs (React-escaped), so admin text can never inject markup. */
export async function StaticPageView({
  pageKey,
  fallbackTitle,
}: {
  pageKey: string;
  fallbackTitle: string;
}) {
  await connection();
  const page = await getPublishedPageCached(pageKey);
  if (!page) {
    return (
      <PageContainer narrow>
        <h1 className="mb-6 text-3xl font-bold">{fallbackTitle}</h1>
        <EmptyState
          title="هذه الصفحة غير متاحة حاليًا"
          description="لم يُنشر محتواها بعد. سيظهر هنا بعد مراجعته واعتماده."
        />
      </PageContainer>
    );
  }
  const updated = formatDate(page.updatedAt);
  return (
    <PageContainer narrow>
      <article>
        <h1 className="text-3xl font-bold">{page.title}</h1>
        {updated && <p className="mt-1 text-sm text-muted-foreground">آخر تحديث: {updated}</p>}
        <div className="mt-6 max-w-[68ch] space-y-4 text-[1.0625rem]">
          {toParagraphs(page.body).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>
      </article>
    </PageContainer>
  );
}