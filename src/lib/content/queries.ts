/**
 * Read-only queries for the PUBLIC site. Every function takes the database as a
 * parameter (so tests can use an in-memory PostgreSQL) and only ever returns
 * content that is approved AND published. Drafts, in-review, unpublished and
 * archived items never leave this module.
 */
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { safeHttpUrl } from "@/lib/format";
import { normalizeArabic } from "@/lib/search/arabic";

export const PAGE_SIZE = 12;

const isPublic = (): SQL =>
  and(
    eq(s.contentItems.publicationStatus, "published"),
    eq(s.contentItems.approvalStatus, "approved"),
  )!;

/* ───────────── Types ───────────── */

export type ContentListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  speakerName: string | null;
  publishedAt: Date | null;
  recordedAt: Date | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  isFeatured: boolean;
  typeKey: string;
  typeName: string;
};

const listColumns = {
  id: s.contentItems.id,
  slug: s.contentItems.slug,
  title: s.contentItems.title,
  summary: s.contentItems.summary,
  speakerName: s.contentItems.speakerName,
  publishedAt: s.contentItems.publishedAt,
  recordedAt: s.contentItems.recordedAt,
  durationSeconds: s.contentItems.durationSeconds,
  thumbnailUrl: s.contentItems.thumbnailUrl,
  isFeatured: s.contentItems.isFeatured,
  typeKey: s.contentTypes.key,
  typeName: s.contentTypes.name,
};

export type ListParams = {
  q?: string;
  type?: string;
  /** Any of these type keys (used by the home page groups). */
  types?: string[];
  category?: string;
  sort?: "newest" | "title";
  page?: number;
  pageSize?: number;
};

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Distinct published items in this category (for top-level: including its sub-categories). */
  count: number;
  children: CategorySummary[];
};

/* ───────────── Search ───────────── */

/**
 * Builds a safe prefix tsquery ("tok1:* & tok2:*") from user input. Tokens are
 * normalised like the stored search_text and reduced to letters/digits, so the
 * result can never contain tsquery operators.
 */
export function buildTsQuery(q: string | undefined): string | null {
  if (!q) return null;
  const tokens = normalizeArabic(q)
    .split(" ")
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean)
    .slice(0, 8);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(" & ") : null;
}

/* ───────────── Content lists ───────────── */

async function categoryIdsWithChildren(db: AnyDb, slug: string): Promise<string[]> {
  const [cat] = await db
    .select({ id: s.categories.id })
    .from(s.categories)
    .where(and(eq(s.categories.slug, slug), eq(s.categories.isActive, true)))
    .limit(1);
  if (!cat) return [];
  const kids = await db
    .select({ id: s.categories.id })
    .from(s.categories)
    .where(and(eq(s.categories.parentId, cat.id), eq(s.categories.isActive, true)));
  return [cat.id, ...kids.map((k) => k.id)];
}

export async function listContent(
  db: AnyDb,
  p: ListParams,
): Promise<{ items: ContentListItem[]; total: number; page: number; pageSize: number }> {
  const pageSize = p.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, p.page ?? 1);
  const empty = { items: [], total: 0, page, pageSize };

  const where: SQL[] = [isPublic()];
  if (p.type) where.push(eq(s.contentTypes.key, p.type));
  if (p.types?.length) where.push(inArray(s.contentTypes.key, p.types));
  if (p.category) {
    const ids = await categoryIdsWithChildren(db, p.category);
    if (ids.length === 0) return empty;
    where.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(s.contentCategories)
          .where(
            and(
              eq(s.contentCategories.contentItemId, s.contentItems.id),
              inArray(s.contentCategories.categoryId, ids),
            ),
          ),
      ),
    );
  }
  const tsq = buildTsQuery(p.q);
  if (tsq) {
    where.push(
      sql`to_tsvector('simple', ${s.contentItems.searchText}) @@ to_tsquery('simple', ${tsq})`,
    );
  }
  const cond = and(...where);

  const order =
    p.sort === "title"
      ? [asc(s.contentItems.title), desc(s.contentItems.id)]
      : [desc(s.contentItems.publishedAt), desc(s.contentItems.id)];

  const items = await db
    .select(listColumns)
    .from(s.contentItems)
    .innerJoin(s.contentTypes, eq(s.contentTypes.id, s.contentItems.contentTypeId))
    .where(cond)
    .orderBy(...order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db
    .select({ total: count() })
    .from(s.contentItems)
    .innerJoin(s.contentTypes, eq(s.contentTypes.id, s.contentItems.contentTypeId))
    .where(cond);

  return { items, total, page, pageSize };
}

export async function listActiveTypes(db: AnyDb) {
  return db
    .select({ key: s.contentTypes.key, name: s.contentTypes.name })
    .from(s.contentTypes)
    .where(eq(s.contentTypes.isActive, true))
    .orderBy(asc(s.contentTypes.sortOrder), asc(s.contentTypes.name));
}

/** Active types that currently have at least one published item. */
export async function listTypesInUse(db: AnyDb) {
  return db
    .select({ key: s.contentTypes.key, name: s.contentTypes.name, count: count() })
    .from(s.contentItems)
    .innerJoin(s.contentTypes, eq(s.contentTypes.id, s.contentItems.contentTypeId))
    .where(and(isPublic(), eq(s.contentTypes.isActive, true)))
    .groupBy(s.contentTypes.id, s.contentTypes.key, s.contentTypes.name, s.contentTypes.sortOrder)
    .orderBy(asc(s.contentTypes.sortOrder));
}

/* ───────────── Single item ───────────── */

export type ContentDetail = ContentListItem & {
  description: string | null;
  copyrightNotice: string | null;
  permissionStatus: string;
  reuseRestrictions: string | null;
  categories: { slug: string; name: string }[];
  tags: { slug: string; name: string }[];
  sources: {
    id: string;
    kind: string;
    url: string;
    sourceName: string | null;
    originalSourceUrl: string | null;
    isPrimary: boolean;
    isDownloadable: boolean;
  }[];
  related: ContentListItem[];
};

export async function getContentBySlug(db: AnyDb, slug: string): Promise<ContentDetail | null> {
  const [row] = await db
    .select({
      ...listColumns,
      description: s.contentItems.description,
      copyrightNotice: s.contentItems.copyrightNotice,
      permissionStatus: s.contentItems.permissionStatus,
      reuseRestrictions: s.contentItems.reuseRestrictions,
    })
    .from(s.contentItems)
    .innerJoin(s.contentTypes, eq(s.contentTypes.id, s.contentItems.contentTypeId))
    .where(and(eq(s.contentItems.slug, slug), isPublic()))
    .limit(1);
  if (!row) return null;

  const [categories, tags, sources, relRows] = await Promise.all([
    db
      .select({ slug: s.categories.slug, name: s.categories.name })
      .from(s.contentCategories)
      .innerJoin(s.categories, eq(s.categories.id, s.contentCategories.categoryId))
      .where(and(eq(s.contentCategories.contentItemId, row.id), eq(s.categories.isActive, true)))
      .orderBy(asc(s.categories.sortOrder), asc(s.categories.name)),
    db
      .select({ slug: s.tags.slug, name: s.tags.name })
      .from(s.contentTags)
      .innerJoin(s.tags, eq(s.tags.id, s.contentTags.tagId))
      .where(eq(s.contentTags.contentItemId, row.id))
      .orderBy(asc(s.tags.name)),
    db
      .select({
        id: s.contentSources.id,
        kind: s.contentSources.kind,
        url: s.contentSources.url,
        sourceName: s.contentSources.sourceName,
        originalSourceUrl: s.contentSources.originalSourceUrl,
        isPrimary: s.contentSources.isPrimary,
        isDownloadable: s.contentSources.isDownloadable,
      })
      .from(s.contentSources)
      .where(eq(s.contentSources.contentItemId, row.id))
      .orderBy(desc(s.contentSources.isPrimary), asc(s.contentSources.sortOrder)),
    db
      .select({ a: s.contentRelations.contentItemId, b: s.contentRelations.relatedItemId })
      .from(s.contentRelations)
      .where(
        or(
          eq(s.contentRelations.contentItemId, row.id),
          eq(s.contentRelations.relatedItemId, row.id),
        ),
      ),
  ]);

  const relatedIds = [...new Set(relRows.map((r) => (r.a === row.id ? r.b : r.a)))];
  const related = relatedIds.length
    ? await db
        .select(listColumns)
        .from(s.contentItems)
        .innerJoin(s.contentTypes, eq(s.contentTypes.id, s.contentItems.contentTypeId))
        .where(and(inArray(s.contentItems.id, relatedIds), isPublic()))
        .orderBy(desc(s.contentItems.publishedAt))
        .limit(6)
    : [];

  return {
    ...row,
    categories,
    tags,
    // Uploaded-file sources have no public URL until Phase 5 (storage); skip them.
    sources: sources.flatMap((x) => (x.url ? [{ ...x, url: x.url }] : [])),
    related,
  };
}

/* ───────────── Categories ───────────── */

/**
 * Active top-level categories with their active children and published-item
 * counts. Assumes two levels (main + sub), which the admin UI enforces.
 */
export async function listCategoryTree(db: AnyDb): Promise<CategorySummary[]> {
  const cats = await db
    .select()
    .from(s.categories)
    .where(eq(s.categories.isActive, true))
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name));

  const direct = await db
    .select({
      id: s.contentCategories.categoryId,
      n: countDistinct(s.contentCategories.contentItemId),
    })
    .from(s.contentCategories)
    .innerJoin(s.contentItems, eq(s.contentItems.id, s.contentCategories.contentItemId))
    .where(isPublic())
    .groupBy(s.contentCategories.categoryId);

  const topExpr = sql<string>`coalesce(${s.categories.parentId}, ${s.categories.id})`;
  const rolled = await db
    .select({ id: topExpr, n: countDistinct(s.contentCategories.contentItemId) })
    .from(s.contentCategories)
    .innerJoin(s.contentItems, eq(s.contentItems.id, s.contentCategories.contentItemId))
    .innerJoin(s.categories, eq(s.categories.id, s.contentCategories.categoryId))
    .where(and(isPublic(), eq(s.categories.isActive, true)))
    .groupBy(topExpr);

  const directMap = new Map(direct.map((d) => [d.id, Number(d.n)]));
  const rolledMap = new Map(rolled.map((d) => [d.id, Number(d.n)]));
  const toSummary = (c: (typeof cats)[number], n: number): CategorySummary => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    imageUrl: c.imageUrl,
    count: n,
    children: [],
  });

  const tops = cats.filter((c) => !c.parentId);
  return tops.map((t) => ({
    ...toSummary(t, rolledMap.get(t.id) ?? 0),
    children: cats
      .filter((c) => c.parentId === t.id)
      .map((c) => toSummary(c, directMap.get(c.id) ?? 0)),
  }));
}

export async function getCategoryBySlug(
  db: AnyDb,
  slug: string,
): Promise<{ category: CategorySummary; parent: CategorySummary | null } | null> {
  const tree = await listCategoryTree(db);
  for (const top of tree) {
    if (top.slug === slug) return { category: top, parent: null };
    const child = top.children.find((c) => c.slug === slug);
    if (child) return { category: child, parent: top };
  }
  return null;
}

/* ───────────── Participations ───────────── */

export type ParticipationSummary = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  eventDate: Date | null;
  location: string | null;
};

export async function listPublishedParticipations(
  db: AnyDb,
  limit = 4,
): Promise<ParticipationSummary[]> {
  return db
    .select({
      id: s.participations.id,
      slug: s.participations.slug,
      title: s.participations.title,
      kind: s.participations.kind,
      eventDate: s.participations.eventDate,
      location: s.participations.location,
    })
    .from(s.participations)
    .where(
      and(
        eq(s.participations.publicationStatus, "published"),
        eq(s.participations.approvalStatus, "approved"),
      ),
    )
    .orderBy(sql`${s.participations.eventDate} desc nulls last`, desc(s.participations.createdAt))
    .limit(limit);
}

/* ───────────── Static pages ───────────── */

export type StaticPageView = { key: string; title: string; body: string; updatedAt: Date };

/** A page counts as available only when published AND it has content. */
export async function getPublishedPage(db: AnyDb, key: string): Promise<StaticPageView | null> {
  const [row] = await db
    .select({
      key: s.staticPages.key,
      title: s.staticPages.title,
      body: s.staticPages.body,
      updatedAt: s.staticPages.updatedAt,
    })
    .from(s.staticPages)
    .where(and(eq(s.staticPages.key, key), eq(s.staticPages.publicationStatus, "published")))
    .limit(1);
  return row && row.body.trim() ? row : null;
}

export async function listPublishedPageLinks(db: AnyDb): Promise<{ key: string; title: string }[]> {
  const rows = await db
    .select({ key: s.staticPages.key, title: s.staticPages.title, body: s.staticPages.body })
    .from(s.staticPages)
    .where(eq(s.staticPages.publicationStatus, "published"))
    .orderBy(asc(s.staticPages.key));
  return rows.filter((r) => r.body.trim()).map(({ key, title }) => ({ key, title }));
}

/* ───────────── Home page ───────────── */

export type HomeData = {
  totalPublished: number;
  latest: ContentListItem[];
  featured: ContentListItem[];
  /** Latest lectures, lessons and audio. */
  lectures: ContentListItem[];
  /** Latest books, research papers and articles. */
  writings: ContentListItem[];
  categories: CategorySummary[];
  types: { key: string; name: string; count: number }[];
  participations: ParticipationSummary[];
  aboutExcerpt: string | null;
};

export async function getHomeData(db: AnyDb): Promise<HomeData> {
  const [latestRes, lecturesRes, writingsRes, featured, tree, types, participations, about] =
    await Promise.all([
      listContent(db, { pageSize: 6 }),
      listContent(db, { types: ["lecture", "lesson", "audio"], pageSize: 3 }),
      listContent(db, { types: ["book", "research", "article"], pageSize: 3 }),
      db
        .select(listColumns)
        .from(s.contentItems)
        .innerJoin(s.contentTypes, eq(s.contentTypes.id, s.contentItems.contentTypeId))
        .where(and(isPublic(), eq(s.contentItems.isFeatured, true)))
        .orderBy(desc(s.contentItems.publishedAt))
        .limit(3),
      listCategoryTree(db),
      listTypesInUse(db),
      listPublishedParticipations(db, 4),
      getPublishedPage(db, "about"),
    ]);
  const body = about?.body.trim() ?? "";
  return {
    totalPublished: latestRes.total,
    latest: latestRes.items,
    featured,
    lectures: lecturesRes.items,
    writings: writingsRes.items,
    categories: tree.filter((c) => c.count > 0).slice(0, 8),
    types: types.map((t) => ({ ...t, count: Number(t.count) })),
    participations,
    aboutExcerpt: body ? (body.length > 320 ? `${body.slice(0, 320).trimEnd()}…` : body) : null,
  };
}

/** Social profile links managed in the admin settings (keys social.youtube / social.x / social.telegram). */
export type SocialLinks = { youtube?: string; x?: string; telegram?: string };

export async function getSocialLinks(db: AnyDb): Promise<SocialLinks> {
  const rows = await db
    .select({ key: s.siteSettings.key, value: s.siteSettings.value })
    .from(s.siteSettings)
    .where(inArray(s.siteSettings.key, ["social.youtube", "social.x", "social.telegram"]));
  const out: SocialLinks = {};
  for (const r of rows) {
    const url = typeof r.value === "string" ? safeHttpUrl(r.value) : null;
    if (!url) continue; // only well-formed http(s) links are ever shown
    if (r.key === "social.youtube") out.youtube = url;
    if (r.key === "social.x") out.x = url;
    if (r.key === "social.telegram") out.telegram = url;
  }
  return out;
}
