import { and, count, desc, eq } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";

export type AdminStats = {
  published: number;
  drafts: number;
  inReview: number;
  categories: number;
  tags: number;
  adminUsers: number;
  recent: {
    id: string;
    action: string;
    entityType: string;
    actorName: string | null;
    createdAt: Date;
  }[];
};

/** Every number is computed from the database; nothing here is a placeholder. */
export async function getAdminStats(db: AnyDb): Promise<AdminStats> {
  const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const [published, drafts, inReview, categories, tags, adminUsers, recent] = await Promise.all([
    n(
      db
        .select({ n: count() })
        .from(s.contentItems)
        .where(eq(s.contentItems.publicationStatus, "published")),
    ),
    n(
      db
        .select({ n: count() })
        .from(s.contentItems)
        .where(eq(s.contentItems.approvalStatus, "draft")),
    ),
    n(
      db
        .select({ n: count() })
        .from(s.contentItems)
        .where(eq(s.contentItems.approvalStatus, "in_review")),
    ),
    n(db.select({ n: count() }).from(s.categories)),
    n(db.select({ n: count() }).from(s.tags)),
    n(
      db
        .select({ n: count() })
        .from(s.users)
        .where(and(eq(s.users.isActive, true))),
    ),
    db
      .select({
        id: s.auditLogs.id,
        action: s.auditLogs.action,
        entityType: s.auditLogs.entityType,
        actorName: s.users.name,
        createdAt: s.auditLogs.createdAt,
      })
      .from(s.auditLogs)
      .leftJoin(s.users, eq(s.users.id, s.auditLogs.actorId))
      .orderBy(desc(s.auditLogs.createdAt))
      .limit(10),
  ]);
  return { published, drafts, inReview, categories, tags, adminUsers, recent };
}