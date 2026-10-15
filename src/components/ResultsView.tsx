import type { ListFilters } from "@/lib/content/params";
import { hasActiveFilters } from "@/lib/content/params";
import type { ContentListItem } from "@/lib/content/queries";
import { ContentGrid } from "./ContentGrid";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";

function countLabel(n: number): string {
  if (n === 1) return "مادة واحدة";
  if (n === 2) return "مادتان";
  return n >= 3 && n <= 10 ? `${n} مواد` : `${n} مادة`;
}

export function ResultsView({
  basePath,
  filters,
  result,
}: {
  basePath: string;
  filters: ListFilters;
  result: { items: ContentListItem[]; total: number; pageSize: number };
}) {
  const { items, total, pageSize } = result;
  const filtered = hasActiveFilters(filters);

  if (total === 0) {
    return filtered ? (
      <EmptyState
        title="لا توجد نتائج مطابقة"
        description="جرّب كلمات أقل أو أعمّ، أو أزل بعض الفلاتر."
        action={{ href: basePath, label: "إزالة الفلاتر" }}
      />
    ) : (
      <EmptyState
        title="لا توجد مواد منشورة بعد"
        description="ستظهر المواد العلمية هنا عند نشرها."
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="لا توجد نتائج في هذه الصفحة"
        action={{ href: basePath, label: "العودة إلى الصفحة الأولى" }}
      />
    );
  }
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {countLabel(total)}
        {filters.q && <> مطابقة لـ «{filters.q}»</>}
      </p>
      <ContentGrid items={items} />
      <Pagination basePath={basePath} filters={filters} total={total} pageSize={pageSize} />
    </>
  );
}