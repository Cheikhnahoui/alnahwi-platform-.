import { desc } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { listCategoryTree, listPublishedPageLinks } from "./queries";
import { and, eq } from "drizzle-orm";

/** Published items, categories and static pages, for sitemap.xml. */
export async function listSitemapData(db: AnyDb) {
  const [items, cats, pages] = await Promise.all([
    db
      .select({ slug: s.contentItems.slug, updatedAt: s.contentItems.updatedAt })
      .from(s.contentItems)
      .where(
        and(
          eq(s.contentItems.publicationStatus, "published"),
          eq(s.contentItems.approvalStatus, "approved"),
        ),
      )
      .orderBy(desc(s.contentItems.publishedAt))
      .limit(5000),
    listCategoryTree(db),
    listPublishedPageLinks(db),
  ]);
  return { items, cats, pages };
}
