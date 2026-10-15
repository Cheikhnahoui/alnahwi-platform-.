export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListFilters = {
  q: string;
  type: string;
  category: string;
  sort: "newest" | "title";
  page: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const CONTROL = /[\u0000-\u001f\u007f]/g;
const clean = (v: string, max: number) => v.replace(CONTROL, "").trim().slice(0, max);

/** Parses and bounds untrusted URL parameters. Never throws. */
export function parseListFilters(raw: RawSearchParams): ListFilters {
  const page = Number.parseInt(first(raw.page), 10);
  return {
    q: clean(first(raw.q), 100),
    type: clean(first(raw.type), 50),
    category: clean(first(raw.category), 100),
    sort: first(raw.sort) === "title" ? "title" : "newest",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 10_000) : 1,
  };
}

export function hasActiveFilters(f: ListFilters): boolean {
  return Boolean(f.q || f.type || f.category || f.sort !== "newest");
}

/** Builds a query string from filters, skipping defaults. */
export function filtersToQuery(f: Partial<ListFilters>, omit: (keyof ListFilters)[] = []): string {
  const p = new URLSearchParams();
  const set = (k: keyof ListFilters, v: string | number | undefined) => {
    if (omit.includes(k) || v === undefined || v === "" || v === 0) return;
    p.set(k, String(v));
  };
  set("q", f.q);
  set("type", f.type);
  set("category", f.category);
  if (f.sort && f.sort !== "newest") set("sort", f.sort);
  if (f.page && f.page > 1) set("page", f.page);
  const s = p.toString();
  return s ? `?${s}` : "";
}