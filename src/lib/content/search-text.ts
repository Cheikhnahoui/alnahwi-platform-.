import { eq } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { buildSearchText } from "@/lib/search/arabic";

/**
 * Recomputes the normalised search text of one item from its title, summary,
 * description, tag names and category names. Call after any change to the item
 * or to its tags/categories (the admin CRUD in Phase 4 does this).
 */
export async function refreshSearchText(db: AnyDb, itemId: string): Promise<void> {
  const [item] = await db.select().from(s.contentItems).where(eq(s.contentItems.id, itemId));
  if (!item) return;
  const tagRows = await db
    .select({ name: s.tags.name })
    .from(s.contentTags)
    .innerJoin(s.tags, eq(s.tags.id, s.contentTags.tagId))
    .where(eq(s.contentTags.contentItemId, itemId));
  const catRows = await db
    .select({ name: s.categories.name })
    .from(s.contentCategories)
    .innerJoin(s.categories, eq(s.categories.id, s.contentCategories.categoryId))
    .where(eq(s.contentCategories.contentItemId, itemId));
  const searchText = buildSearchText(
    item.title,
    item.summary,
    item.description,
    item.speakerName,
    ...tagRows.map((t) => t.name),
    ...catRows.map((c) => c.name),
  );
  await db.update(s.contentItems).set({ searchText }).where(eq(s.contentItems.id, itemId));
}