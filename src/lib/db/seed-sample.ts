/**
 * DEVELOPMENT SAMPLE DATA. Every record is flagged is_sample (or has a
 * "sample-" slug) and is plainly labelled "تجريبي". Nothing here is attributed to
 * the Sheikh: speaker_name stays empty. Never run in production; use
 * purgeSampleData() to remove it.
 */
import { eq, like } from "drizzle-orm";
import { refreshSearchText } from "@/lib/content/search-text";
import * as s from "./schema";
import type { AnyDb } from "./types";

const DAY = 86_400_000;

export const SAMPLE_COUNTS = {
  items: 30,
  published: 26, // items 25-28 are draft / in_review / approved-unpublished / archived
  hidden: 4,
};

export async function seedSampleData(db: AnyDb) {
  const types = (await db.select().from(s.contentTypes).orderBy(s.contentTypes.sortOrder)).slice(
    0,
    5,
  );
  if (types.length === 0) throw new Error("Content types missing — run `npm run db:seed` first.");

  const cat = async (slug: string, name: string, sortOrder: number, parentId?: string) => {
    const [row] = await db
      .insert(s.categories)
      .values({ slug, name, sortOrder, parentId, description: "تصنيف تجريبي لاختبار التصميم." })
      .onConflictDoUpdate({ target: s.categories.slug, set: { name } })
      .returning();
    return row;
  };
  const catA = await cat("sample-category-a", "تصنيف تجريبي أ", 1);
  const catA1 = await cat("sample-category-a1", "تصنيف فرعي تجريبي", 1, catA.id);
  const catB = await cat("sample-category-b", "تصنيف تجريبي ب", 2);

  const tag = async (slug: string, name: string) => {
    const [row] = await db
      .insert(s.tags)
      .values({ slug, name })
      .onConflictDoUpdate({ target: s.tags.slug, set: { name } })
      .returning();
    return row;
  };
  const tag1 = await tag("sample-tag-1", "وسم تجريبي");
  const tag2 = await tag("sample-tag-2", "كلمة مفتاحية تجريبية");

  const now = Date.now();
  const ids: string[] = [];
  for (let i = 1; i <= SAMPLE_COUNTS.items; i++) {
    const published = ![25, 26, 27, 28].includes(i);
    const approvalStatus = i === 25 ? "draft" : i === 26 ? "in_review" : "approved";
    const publicationStatus = published ? "published" : i === 28 ? "archived" : "unpublished";
    const [item] = await db
      .insert(s.contentItems)
      .values({
        slug: `sample-item-${i}`,
        title: `مادة تجريبية رقم ${i}`,
        summary: `ملخص تجريبي رقم ${i} لاختبار شكل البطاقات.`,
        description: `نص تجريبي لاختبار التصميم فقط، وليس من مواد الشيخ.\n\nالفقرة الثانية من النص التجريبي للمادة رقم ${i}.`,
        contentTypeId: types[i % types.length].id,
        approvalStatus,
        publicationStatus,
        publishedAt: published ? new Date(now - i * DAY) : null,
        recordedAt: i % 4 === 0 ? new Date(now - (i + 400) * DAY) : null,
        durationSeconds: i % 3 === 0 ? 600 + i * 37 : null,
        isFeatured: published && i % 5 === 0,
        isSample: true,
      })
      .onConflictDoNothing({ target: s.contentItems.slug })
      .returning();
    if (!item) continue; // already seeded
    ids.push(item.id);

    const catIds = [
      i % 2 === 1 ? catA.id : null,
      i % 4 === 0 ? catB.id : null,
      i % 3 === 0 ? catA1.id : null,
    ].filter((x): x is string => !!x);
    if (catIds.length) {
      await db
        .insert(s.contentCategories)
        .values(catIds.map((categoryId) => ({ contentItemId: item.id, categoryId })));
    }
    const tagIds = [i % 2 === 0 ? tag1.id : null, i % 3 === 0 ? tag2.id : null].filter(
      (x): x is string => !!x,
    );
    if (tagIds.length) {
      await db
        .insert(s.contentTags)
        .values(tagIds.map((tagId) => ({ contentItemId: item.id, tagId })));
    }
    await db.insert(s.contentSources).values({
      contentItemId: item.id,
      kind: "external_link",
      url: `https://example.org/sample/${i}`,
      sourceName: "مصدر تجريبي",
      isPrimary: true,
    });
    await refreshSearchText(db, item.id);
  }

  const idOf = async (slug: string) =>
    (
      await db
        .select({ id: s.contentItems.id })
        .from(s.contentItems)
        .where(eq(s.contentItems.slug, slug))
    )[0]?.id;
  const [i1, i2, i25] = await Promise.all([
    idOf("sample-item-1"),
    idOf("sample-item-2"),
    idOf("sample-item-25"),
  ]);
  if (i1 && i2 && i25 && ids.length) {
    await db
      .insert(s.contentRelations)
      .values([
        { contentItemId: i1, relatedItemId: i2 },
        { contentItemId: i1, relatedItemId: i25 }, // draft: must never show on the public page
      ])
      .onConflictDoNothing();
  }

  await db
    .insert(s.participations)
    .values([
      {
        slug: "sample-participation-1",
        title: "مشاركة تجريبية لاختبار التصميم",
        kind: "seminar",
        description: "بيانات تجريبية وليست مشاركة حقيقية.",
        approvalStatus: "approved",
        publicationStatus: "published",
        isSample: true,
      },
      {
        slug: "sample-participation-2",
        title: "مشاركة تجريبية غير منشورة",
        kind: "other",
        isSample: true,
      },
    ])
    .onConflictDoNothing({ target: s.participations.slug });

  return { itemsCreated: ids.length };
}

/** Removes every sample record. Safe to run on a database that also holds real content. */
export async function purgeSampleData(db: AnyDb) {
  await db.delete(s.participations).where(eq(s.participations.isSample, true));
  await db.delete(s.contentItems).where(eq(s.contentItems.isSample, true));
  // children first (parent_id is RESTRICT)
  const sampleCats = await db
    .select()
    .from(s.categories)
    .where(like(s.categories.slug, "sample-%"));
  for (const c of sampleCats.filter((c) => c.parentId))
    await db.delete(s.categories).where(eq(s.categories.id, c.id));
  for (const c of sampleCats.filter((c) => !c.parentId))
    await db.delete(s.categories).where(eq(s.categories.id, c.id));
  await db.delete(s.tags).where(like(s.tags.slug, "sample-%"));
}