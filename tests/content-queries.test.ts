import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import { SAMPLE_COUNTS, purgeSampleData, seedSampleData } from "@/lib/db/seed-sample";
import * as s from "@/lib/db/schema";
import * as q from "@/lib/content/queries";
import { filtersToQuery, hasActiveFilters, parseListFilters } from "@/lib/content/params";
import { formatDuration, safeDecode, safeHttpUrl, toParagraphs } from "@/lib/format";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
const all = { pageSize: 100 };

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
  await seedSampleData(ctx.db);
});
afterAll(async () => ctx.client.close());

describe("public visibility", () => {
  it("lists only approved + published items", async () => {
    const r = await q.listContent(ctx.db, all);
    expect(r.total).toBe(SAMPLE_COUNTS.published);
    const slugs = r.items.map((i) => i.slug);
    for (const hidden of [25, 26, 27, 28]) expect(slugs).not.toContain(`sample-item-${hidden}`);
  });
  it("returns null for draft, in-review, unpublished and archived items", async () => {
    for (const n of [25, 26, 27, 28]) {
      expect(await q.getContentBySlug(ctx.db, `sample-item-${n}`)).toBeNull();
    }
    expect(await q.getContentBySlug(ctx.db, "does-not-exist")).toBeNull();
  });
  it("returns a published item with sources, tags and categories", async () => {
    const d = await q.getContentBySlug(ctx.db, "sample-item-6");
    expect(d?.sources[0].url).toBe("https://example.org/sample/6");
    expect(d?.tags.length).toBeGreaterThan(0);
    expect(d?.categories.length).toBeGreaterThan(0);
  });
  it("never shows an unpublished item as related", async () => {
    const d = await q.getContentBySlug(ctx.db, "sample-item-1");
    expect(d?.related.map((r) => r.slug)).toEqual(["sample-item-2"]);
    // relation is visible from the other side too
    const d2 = await q.getContentBySlug(ctx.db, "sample-item-2");
    expect(d2?.related.map((r) => r.slug)).toEqual(["sample-item-1"]);
  });
  it("hides unpublished static pages and empty published pages", async () => {
    expect(await q.getPublishedPage(ctx.db, "about")).toBeNull();
    await ctx.db
      .update(s.staticPages)
      .set({ publicationStatus: "published" })
      .where(eq(s.staticPages.key, "about"));
    expect(await q.getPublishedPage(ctx.db, "about")).toBeNull(); // published but empty
    await ctx.db
      .update(s.staticPages)
      .set({ body: "نص موثق" })
      .where(eq(s.staticPages.key, "about"));
    expect((await q.getPublishedPage(ctx.db, "about"))?.body).toBe("نص موثق");
    expect((await q.listPublishedPageLinks(ctx.db)).map((p) => p.key)).toEqual(["about"]);
    await ctx.db
      .update(s.staticPages)
      .set({ publicationStatus: "unpublished", body: "" })
      .where(eq(s.staticPages.key, "about"));
  });
  it("lists only published participations", async () => {
    const p = await q.listPublishedParticipations(ctx.db);
    expect(p.map((x) => x.slug)).toEqual(["sample-participation-1"]);
  });
});

describe("pagination and sorting", () => {
  it("pages without overlap and reports the total", async () => {
    const p1 = await q.listContent(ctx.db, { page: 1 });
    const p2 = await q.listContent(ctx.db, { page: 2 });
    const p3 = await q.listContent(ctx.db, { page: 3 });
    expect(p1.items).toHaveLength(12);
    expect(p2.items).toHaveLength(12);
    expect(p3.items).toHaveLength(2);
    expect(p1.total).toBe(26);
    const ids = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(26);
  });
  it("sorts newest first by default and by title on request", async () => {
    const newest = await q.listContent(ctx.db, all);
    expect(newest.items[0].slug).toBe("sample-item-1");
    const byTitle = await q.listContent(ctx.db, { ...all, sort: "title" });
    const titles = byTitle.items.map((i) => i.title);
    // In-memory PostgreSQL uses plain code-point ordering, so this is deterministic here.
    expect(titles).toEqual([...titles].sort());
    expect(titles[0]).toBe("مادة تجريبية رقم 1");
    expect(titles[1]).toBe("مادة تجريبية رقم 10"); // title order, not date order
    expect(new Set(titles).size).toBe(26);
  });
});

describe("search and filters", () => {
  it("finds by title, ignoring hamza and diacritics in the query", async () => {
    const r = await q.listContent(ctx.db, { q: "مَادَّة تَجْرِيبِيَّة رقم 7" });
    expect(r.items.map((i) => i.slug)).toContain("sample-item-7");
    const r2 = await q.listContent(ctx.db, { q: "تجريبيه" }); // ta marbuta typed as ha
    expect(r2.total).toBe(26);
  });
  it("matches prefixes and combines words with AND", async () => {
    expect((await q.listContent(ctx.db, { q: "تجرib" })).total).toBe(0);
    expect((await q.listContent(ctx.db, { q: "تجري رقم 12" })).items.map((i) => i.slug)).toEqual([
      "sample-item-12",
    ]);
  });
  it("finds by tag name and by category name", async () => {
    const byTag = await q.listContent(ctx.db, { ...all, q: "كلمة مفتاحية" });
    expect(byTag.total).toBeGreaterThan(0);
    for (const i of byTag.items) expect(Number(i.slug.split("-")[2]) % 3).toBe(0);
    const byCat = await q.listContent(ctx.db, { ...all, q: "تصنيف فرعي" });
    expect(byCat.total).toBeGreaterThan(0);
  });
  it("returns no results (not an error) for unmatched or hostile queries", async () => {
    expect((await q.listContent(ctx.db, { q: "كلمةلاوجودلها" })).total).toBe(0);
    for (const bad of [
      "')|&!:*",
      "a:b | c",
      "(((",
      "\\",
      "'; DROP TABLE content_items; --",
      "!!!",
      ":*",
    ]) {
      await expect(q.listContent(ctx.db, { q: bad })).resolves.toBeDefined();
    }
    expect(await ctx.db.select().from(s.contentItems)).toHaveLength(30);
  });
  it("filters by content type", async () => {
    const lecture = await q.listContent(ctx.db, { ...all, type: "lecture" });
    expect(lecture.total).toBeGreaterThan(0);
    for (const i of lecture.items) expect(i.typeKey).toBe("lecture");
    expect((await q.listContent(ctx.db, { type: "nope" })).total).toBe(0);
  });
  it("filters by several types at once", async () => {
    const r = await q.listContent(ctx.db, { ...all, types: ["lecture", "lesson"] });
    expect(r.total).toBeGreaterThan(0);
    for (const i of r.items) expect(["lecture", "lesson"]).toContain(i.typeKey);
  });
  it("filters by category including its sub-categories", async () => {
    const a = await q.listContent(ctx.db, { ...all, category: "sample-category-a" });
    const a1 = await q.listContent(ctx.db, { ...all, category: "sample-category-a1" });
    expect(a1.total).toBeGreaterThan(0);
    const aSlugs = new Set(a.items.map((i) => i.slug));
    for (const i of a1.items) expect(aSlugs.has(i.slug)).toBe(true); // children roll up into the parent
    expect((await q.listContent(ctx.db, { category: "unknown" })).total).toBe(0);
  });
  it("combines search, type and category", async () => {
    const r = await q.listContent(ctx.db, {
      ...all,
      q: "تجريبية",
      type: "lesson",
      category: "sample-category-b",
    });
    for (const i of r.items) expect(i.typeKey).toBe("lesson");
  });
  it("does not list inactive categories", async () => {
    await ctx.db
      .update(s.categories)
      .set({ isActive: false })
      .where(eq(s.categories.slug, "sample-category-b"));
    expect((await q.listContent(ctx.db, { category: "sample-category-b" })).total).toBe(0);
    expect((await q.listCategoryTree(ctx.db)).map((c) => c.slug)).not.toContain(
      "sample-category-b",
    );
    await ctx.db
      .update(s.categories)
      .set({ isActive: true })
      .where(eq(s.categories.slug, "sample-category-b"));
  });
});

describe("categories, types and home data", () => {
  it("builds the tree with distinct published counts", async () => {
    const tree = await q.listCategoryTree(ctx.db);
    expect(tree.map((c) => c.slug)).toEqual(["sample-category-a", "sample-category-b"]);
    const a = tree[0];
    const aAll = await q.listContent(ctx.db, { ...all, category: "sample-category-a" });
    expect(a.count).toBe(aAll.total); // rolled-up count matches what the page lists
    expect(a.children.map((c) => c.slug)).toEqual(["sample-category-a1"]);
  });
  it("finds a category (and its parent) by slug", async () => {
    expect((await q.getCategoryBySlug(ctx.db, "sample-category-a1"))?.parent?.slug).toBe(
      "sample-category-a",
    );
    expect(await q.getCategoryBySlug(ctx.db, "missing")).toBeNull();
  });
  it("lists types that are in use with counts", async () => {
    const t = await q.listTypesInUse(ctx.db);
    expect(t.reduce((n, x) => n + Number(x.count), 0)).toBe(26);
  });
  it("assembles home data from published content only", async () => {
    const h = await q.getHomeData(ctx.db);
    expect(h.totalPublished).toBe(26);
    expect(h.latest).toHaveLength(6);
    expect(h.featured.every((f) => f.isFeatured)).toBe(true);
    expect(h.lectures.length).toBeGreaterThan(0);
    for (const i of h.lectures) expect(["lecture", "lesson", "audio"]).toContain(i.typeKey);
    for (const i of h.writings) expect(["book", "research", "article"]).toContain(i.typeKey);
    expect(h.participations).toHaveLength(1);
    expect(h.aboutExcerpt).toBeNull();
  });
});


describe("sample data lifecycle", () => {
  it("seeding twice does not duplicate", async () => {
    await seedSampleData(ctx.db);
    expect(await ctx.db.select().from(s.contentItems)).toHaveLength(30);
  });
  it("purge removes all sample records but keeps real ones", async () => {
    const [type] = await ctx.db.select().from(s.contentTypes).limit(1);
    await ctx.db
      .insert(s.contentItems)
      .values({ slug: "real-1", title: "حقيقية", contentTypeId: type.id });
    await purgeSampleData(ctx.db);
    expect(await ctx.db.select().from(s.contentItems)).toHaveLength(1);
    expect(await ctx.db.select().from(s.categories)).toHaveLength(0);
    expect(await ctx.db.select().from(s.tags)).toHaveLength(0);
    expect(await ctx.db.select().from(s.participations)).toHaveLength(0);
  });
});

describe("URL parameter parsing and helpers", () => {
  it("bounds and defaults untrusted parameters", () => {
    expect(parseListFilters({})).toEqual({
      q: "",
      type: "",
      category: "",
      sort: "newest",
      page: 1,
    });
    expect(parseListFilters({ page: "-3" }).page).toBe(1);
    expect(parseListFilters({ page: "abc" }).page).toBe(1);
    expect(parseListFilters({ page: "99999999" }).page).toBe(10_000);
    expect(parseListFilters({ sort: "drop table" }).sort).toBe("newest");
    expect(parseListFilters({ q: ["first", "second"] }).q).toBe("first");
    expect(parseListFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
    expect(parseListFilters({ q: "  فقه\u0000 " }).q).toBe("فقه");
  });
  it("builds clean query strings", () => {
    expect(filtersToQuery({ q: "فقه", sort: "newest", page: 1 })).toBe(
      `?q=${encodeURIComponent("فقه")}`,
    );
    expect(filtersToQuery({ type: "lecture", sort: "title", page: 3 })).toBe(
      "?type=lecture&sort=title&page=3",
    );
    expect(filtersToQuery({ q: "a", page: 2 }, ["page"])).toBe("?q=a");
    expect(filtersToQuery({})).toBe("");
    expect(hasActiveFilters(parseListFilters({}))).toBe(false);
    expect(hasActiveFilters(parseListFilters({ sort: "title" }))).toBe(true);
  });
  it("only accepts http(s) URLs", () => {
    expect(safeHttpUrl("https://example.org/a")).toBe("https://example.org/a");
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,x",
      "//evil.com",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(safeHttpUrl(bad as string | null)).toBeNull();
    }
  });
  it("formats durations, decodes params and splits paragraphs", () => {
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(null)).toBeNull();
    expect(safeDecode("%D9%81%D9%82%D9%87")).toBe("فقه");
    expect(safeDecode("%E0%A4%A")).toBe("%E0%A4%A"); // malformed: returned untouched, no throw
    expect(toParagraphs("أ\n\nب\n \n\nج")).toEqual(["أ", "ب", "ج"]);
  });
});