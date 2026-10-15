import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { filtersToQuery, type ListFilters } from "@/lib/content/params";

function windowPages(page: number, last: number): (number | "gap")[] {
  const set = new Set([1, last, page - 1, page, page + 1].filter((n) => n >= 1 && n <= last));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export function Pagination({
  basePath,
  filters,
  total,
  pageSize,
}: {
  basePath: string;
  filters: ListFilters;
  total: number;
  pageSize: number;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  const page = Math.min(filters.page, last);
  const href = (p: number) => `${basePath}${filtersToQuery({ ...filters, page: p })}`;
  const base =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm";
  const idle = `${base} border-border hover:bg-muted`;

  return (
    <nav
      aria-label="ترقيم الصفحات"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${idle} gap-1`}>
          <ChevronRight aria-hidden size={16} />
          السابق
        </Link>
      ) : null}
      {windowPages(page, last).map((n, i) =>
        n === "gap" ? (
          <span key={`g${i}`} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ) : n === page ? (
          <span
            key={n}
            aria-current="page"
            className={`${base} border-accent bg-accent font-semibold text-accent-foreground`}
          >
            {n}
          </span>
        ) : (
          <Link key={n} href={href(n)} className={idle} aria-label={`الصفحة ${n}`}>
            {n}
          </Link>
        ),
      )}
      {page < last ? (
        <Link href={href(page + 1)} rel="next" className={`${idle} gap-1`}>
          التالي
          <ChevronLeft aria-hidden size={16} />
        </Link>
      ) : null}
    </nav>
  );
}