import Link from "next/link";
import type { ListFilters } from "@/lib/content/params";
import { hasActiveFilters } from "@/lib/content/params";
import type { CategorySummary } from "@/lib/content/queries";

const selectClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-accent";

/** GET form with search + filters + sort. `categories` omitted = no category filter. */
export function FilterPanel({
  action,
  filters,
  types,
  categories,
}: {
  action: string;
  filters: ListFilters;
  types: { key: string; name: string }[];
  categories?: CategorySummary[];
}) {
  const flat = categories?.flatMap((c) => [
    { slug: c.slug, name: c.name },
    ...c.children.map((k) => ({ slug: k.slug, name: `${c.name} › ${k.name}` })),
  ]);
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="space-y-4 rounded-md border border-border p-4"
    >
      <div>
        <label htmlFor="f-q" className="mb-1 block text-sm font-semibold">
          كلمات البحث
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={100}
          placeholder="العنوان أو الوصف أو الوسوم"
          className={selectClass}
        />
      </div>
      <div className={`grid gap-4 sm:grid-cols-2 ${flat ? "lg:grid-cols-3" : ""}`}>
        <div>
          <label htmlFor="f-type" className="mb-1 block text-sm font-semibold">
            نوع المادة
          </label>
          <select id="f-type" name="type" defaultValue={filters.type} className={selectClass}>
            <option value="">كل الأنواع</option>
            {types.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {flat && (
          <div>
            <label htmlFor="f-category" className="mb-1 block text-sm font-semibold">
              التصنيف
            </label>
            <select
              id="f-category"
              name="category"
              defaultValue={filters.category}
              className={selectClass}
            >
              <option value="">كل التصنيفات</option>
              {flat.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="f-sort" className="mb-1 block text-sm font-semibold">
            الترتيب
          </label>
          <select id="f-sort" name="sort" defaultValue={filters.sort} className={selectClass}>
            <option value="newest">الأحدث أولًا</option>
            <option value="title">حسب العنوان</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-foreground hover:opacity-90"
        >
          تطبيق
        </button>
        {hasActiveFilters(filters) && (
          <Link href={action} className="text-sm text-accent underline underline-offset-4">
            إزالة الفلاتر
          </Link>
        )}
      </div>
    </form>
  );
}