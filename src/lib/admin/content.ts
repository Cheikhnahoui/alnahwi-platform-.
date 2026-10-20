/**
 * Administrative content operations. Every function re-checks the actor's
 * permissions itself (defence in depth: pages and actions check too), runs in
 * one transaction, refreshes the search text and writes an audit entry.
 */
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { refreshSearchText } from "@/lib/content/search-text";
import type { ContentDetail } from "@/lib/content/queries";
import { buildTsQuery } from "@/lib/content/queries";
import type { PermissionKey } from "@/lib/auth/permissions";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { writeAudit } from "./audit";
import type { ContentData, SourceInput } from "./content-input";
import { slugify } from "./slug";
import { hasPermission, workflowState, type Actor, type Transition } from "./workflow";

export {
  availableTransitions,
  TRANSITION_LABELS,
  WORKFLOW_LABELS,
  workflowState,
  type Actor,
  type Transition,
  type WorkflowState,
} from "./workflow";

export class PermissionError extends Error {}
export class WorkflowError extends Error {}
export class ValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super(Object.values(errors)[0] ?? "بيانات غير صالحة.");
  }
}

const can = hasPermission;
function assertCan(a: Actor, p: PermissionKey, message = "ليست لديك صلاحية لهذا الإجراء.") {
  if (!can(a, p)) throw new PermissionError(message);
}

export async function getRequireReview(db: AnyDb): Promise<boolean> {
  const [row] = await db
    .select({ value: s.siteSettings.value })
    .from(s.siteSettings)
    .where(eq(s.siteSettings.key, "workflow.require_review"))
    .limit(1);
  return row?.value === true;
}

/* ───────────── Helpers ───────────── */

async function uniqueSlug(db: AnyDb, base: string, excludeId?: string): Promise<string> {
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [hit] = await db
      .select({ id: s.contentItems.id })
      .from(s.contentItems)
      .where(eq(s.contentItems.slug, candidate))
      .limit(1);
    if (!hit || hit.id === excludeId) return candidate;
  }
  throw new WorkflowError("تعذّر توليد رابط فريد للمادة.");
}

async function assertReferences(db: AnyDb, data: ContentData) {
  const [type] = await db
    .select({ id: s.contentTypes.id })
    .from(s.contentTypes)
    .where(and(eq(s.contentTypes.id, data.contentTypeId), eq(s.contentTypes.isActive, true)))
    .limit(1);
  if (!type) throw new ValidationError({ contentTypeId: "نوع المادة غير موجود." });
  if (data.categoryIds.length) {
    const found = await db
      .select({ id: s.categories.id })
      .from(s.categories)
      .where(inArray(s.categories.id, data.categoryIds));
    if (found.length !== data.categoryIds.length) {
      throw new ValidationError({ categoryIds: "أحد التصنيفات غير موجود." });
    }
  }
}

/** Replaces categories, tags, sources and outgoing relations of one item. */
async function writeRelations(db: AnyDb, itemId: string, data: ContentData) {
  await db.delete(s.contentCategories).where(eq(s.contentCategories.contentItemId, itemId));
  if (data.categoryIds.length) {
    await db
      .insert(s.contentCategories)
      .values(data.categoryIds.map((categoryId) => ({ contentItemId: itemId, categoryId })));
  }

  await db.delete(s.contentTags).where(eq(s.contentTags.contentItemId, itemId));
  if (data.tags.length) {
    const rows = data.tags.map((name) => ({ slug: slugify(name), name }));
    await db.insert(s.tags).values(rows).onConflictDoNothing({ target: s.tags.slug });
    const ids = await db
      .select({ id: s.tags.id })
      .from(s.tags)
      .where(
        inArray(
          s.tags.slug,
          rows.map((r) => r.slug),
        ),
      );
    await db.insert(s.contentTags).values(ids.map((t) => ({ contentItemId: itemId, tagId: t.id })));
  }

  await db.delete(s.contentSources).where(eq(s.contentSources.contentItemId, itemId));
  if (data.sources.length) {
    await db.insert(s.contentSources).values(
      data.sources.map((src, i) => ({
        contentItemId: itemId,
        kind: src.kind,
        url: src.url,
        sourceName: src.sourceName,
        isPrimary: src.isPrimary,
        isDownloadable: src.isDownloadable,
        sortOrder: i,
      })),
    );
  }

  await db.delete(s.contentRelations).where(eq(s.contentRelations.contentItemId, itemId));
  if (data.relatedSlugs.length) {
    const found = await db
      .select({ id: s.contentItems.id, slug: s.contentItems.slug })
      .from(s.contentItems)
      .where(inArray(s.contentItems.slug, data.relatedSlugs));
    const missing = data.relatedSlugs.filter((sl) => !found.some((f) => f.slug === sl));
    if (missing.length) {
      throw new ValidationError({ related: `مواد غير موجودة: ${missing.join("، ")}` });
    }
    const ids = found.map((f) => f.id).filter((id) => id !== itemId);
    if (ids.length) {
      await db
        .insert(s.contentRelations)
        .values(ids.map((relatedItemId) => ({ contentItemId: itemId, relatedItemId })));
    }
  }
}

const scalars = (d: ContentData) => ({
  title: d.title,
  summary: d.summary,
  description: d.description,
  contentTypeId: d.contentTypeId,
  speakerName: d.speakerName,
  recordedAt: d.recordedAt,
  durationSeconds: d.durationSeconds,
  thumbnailUrl: d.thumbnailUrl,
  copyrightNotice: d.copyrightNotice,
  permissionStatus: d.permissionStatus,
  reuseRestrictions: d.reuseRestrictions,
});

/* ───────────── Create / update ───────────── */

export async function createContent(db: AnyDb, actor: Actor, data: ContentData) {
  assertCan(actor, "content.create");
  return db.transaction(async (tx) => {
    await assertReferences(tx, data);
    let slug: string;
    if (data.slug) {
      slug = await uniqueSlug(tx, data.slug);
      if (slug !== data.slug) throw new ValidationError({ slug: "هذا الرابط مستخدم لمادة أخرى." });
    } else {
      slug = await uniqueSlug(tx, slugify(data.title));
    }
    const [row] = await tx
      .insert(s.contentItems)
      .values({
        ...scalars(data),
        slug,
        // Home-page placement is an editorial decision: only publishers may set it.
        isFeatured: can(actor, "content.publish") ? data.isFeatured : false,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning({ id: s.contentItems.id, slug: s.contentItems.slug });
    await writeRelations(tx, row.id, data);
    await refreshSearchText(tx, row.id);
    await writeAudit(tx, {
      actorId: actor.id,
      action: "content.create",
      entityType: "content_item",
      entityId: row.id,
      metadata: { title: data.title.slice(0, 120) },
    });
    return row;
  });
}

export async function updateContent(db: AnyDb, actor: Actor, id: string, data: ContentData) {
  assertCan(actor, "content.edit");
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(s.contentItems).where(eq(s.contentItems.id, id));
    if (!item) throw new WorkflowError("المادة غير موجودة.");
    const st = workflowState(item);
    if (st === "archived") throw new WorkflowError("المادة مؤرشفة. استعدها أولًا ثم عدّلها.");
    if ((st === "approved" || st === "published") && !can(actor, "content.publish")) {
      throw new PermissionError(
        "هذه المادة معتمدة أو منشورة، وتعديلها يتطلب صلاحية النشر. اطلب من مدير المحتوى.",
      );
    }
    await assertReferences(tx, data);
    let slug = item.slug;
    if (data.slug && data.slug !== item.slug) {
      if ((await uniqueSlug(tx, data.slug, id)) !== data.slug) {
        throw new ValidationError({ slug: "هذا الرابط مستخدم لمادة أخرى." });
      }
      slug = data.slug;
    }
    await tx
      .update(s.contentItems)
      .set({
        ...scalars(data),
        slug,
        isFeatured: can(actor, "content.publish") ? data.isFeatured : item.isFeatured,
        updatedBy: actor.id,
      })
      .where(eq(s.contentItems.id, id));
    await writeRelations(tx, id, data);
    await refreshSearchText(tx, id);
    await writeAudit(tx, {
      actorId: actor.id,
      action: "content.update",
      entityType: "content_item",
      entityId: id,
      metadata: { state: st },
    });
    return { id, slug };
  });
}

/* ───────────── Workflow transitions ───────────── */

export async function transition(db: AnyDb, actor: Actor, id: string, action: Transition) {
  return db.transaction(async (tx) => {
    const [item] = await tx.select().from(s.contentItems).where(eq(s.contentItems.id, id));
    if (!item) throw new WorkflowError("المادة غير موجودة.");
    const st = workflowState(item);
    const requireReview = await getRequireReview(tx);
    const bad = () => new WorkflowError("هذا الإجراء غير متاح في الحالة الحالية للمادة.");
    const metadata: Record<string, string | boolean> = { from: st };
    let patch: Partial<typeof s.contentItems.$inferInsert>;

    switch (action) {
      case "submit":
        assertCan(actor, "content.edit");
        if (st !== "draft") throw bad();
        patch = { approvalStatus: "in_review" };
        break;
      case "approve":
        assertCan(actor, "content.review");
        if (st !== "in_review") throw bad();
        patch = { approvalStatus: "approved" };
        break;
      case "request_changes":
        assertCan(actor, "content.review");
        if (st !== "in_review") throw bad();
        patch = { approvalStatus: "draft" };
        break;
      case "publish":
        assertCan(actor, "content.publish");
        if (st === "published" || st === "archived") throw bad();
        if (st !== "approved") {
          if (requireReview) throw new WorkflowError("لا تُنشر المادة قبل اعتمادها.");
          metadata.autoApproved = true;
        }
        patch = {
          approvalStatus: "approved",
          publicationStatus: "published",
          publishedAt: item.publishedAt ?? new Date(),
        };
        break;
      case "unpublish":
        assertCan(actor, "content.publish");
        if (st !== "published") throw bad();
        patch = { publicationStatus: "unpublished" };
        break;
      case "archive":
        assertCan(actor, "content.archive");
        if (st === "archived") throw bad();
        patch = { publicationStatus: "archived" };
        break;
      case "restore":
        assertCan(actor, "content.archive");
        if (st !== "archived") throw bad();
        patch = { publicationStatus: "unpublished" };
        break;
    }
    await tx
      .update(s.contentItems)
      .set({ ...patch, updatedBy: actor.id })
      .where(eq(s.contentItems.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: `content.${action}`,
      entityType: "content_item",
      entityId: id,
      metadata,
    });
    return { id, slug: item.slug };
  });
}

/* ───────────── Admin reads ───────────── */

export type AdminContentRow = {
  id: string;
  title: string;
  slug: string;
  typeName: string;
  approvalStatus: string;
  publicationStatus: string;
  updatedAt: Date;
  updatedByName: string | null;
};

export const ADMIN_PAGE_SIZE = 20;
export const STATE_FILTERS = ["draft", "in_review", "approved", "published", "archived"] as const;

export async function listAdminContent(
  db: AnyDb,
  f: { q?: string; state?: string; typeId?: string; page?: number },
): Promise<{ items: AdminContentRow[]; total: number; page: number; pageSize: number }> {
  const where: SQL[] = [];
  const A = s.contentItems.approvalStatus;
  const P = s.contentItems.publicationStatus;
  switch (f.state) {
    case "draft":
      where.push(and(eq(A, "draft"), sql`${P} <> 'archived'`)!);
      break;
    case "in_review":
      where.push(and(eq(A, "in_review"), sql`${P} <> 'archived'`)!);
      break;
    case "approved":
      where.push(and(eq(A, "approved"), eq(P, "unpublished"))!);
      break;
    case "published":
      where.push(eq(P, "published"));
      break;
    case "archived":
      where.push(eq(P, "archived"));
      break;
  }
  if (f.typeId && /^[0-9a-f-]{36}$/i.test(f.typeId))
    where.push(eq(s.contentItems.contentTypeId, f.typeId));
  const tsq = buildTsQuery(f.q);
  if (tsq) {
    where.push(
      sql`to_tsvector('simple', ${s.contentItems.searchText}) @@ to_tsquery('simple', ${tsq})`,
    );
  }
  const cond = where.length ? and(...where) : undefined;
  const page = Math.max(1, f.page ?? 1);

  const items = await db
    .select({
      id: s.contentItems.id,
      title: s.contentItems.title,
      slug: s.contentItems.slug,
      typeName: s.contentTypes.name,
      approvalStatus: A,
      publicationStatus: P,
      updatedAt: s.contentItems.updatedAt,
      updatedByName: s.users.name,
    })
    .from(s.contentItems)
    .innerJoin(s.contentTypes, eq(s.contentTypes.id, s.contentItems.contentTypeId))
    .leftJoin(s.users, eq(s.users.id, s.contentItems.updatedBy))
    .where(cond)
    .orderBy(desc(s.contentItems.updatedAt), desc(s.contentItems.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  const [{ total }] = await db.select({ total: count() }).from(s.contentItems).where(cond);
  return { items, total: Number(total), page, pageSize: ADMIN_PAGE_SIZE };
}

export type AdminContentFull = {
  item: typeof s.contentItems.$inferSelect;
  categoryIds: string[];
  tags: string[];
  relatedSlugs: string[];
  sources: (SourceInput & { id: string })[];
};

export async function getAdminContent(db: AnyDb, id: string): Promise<AdminContentFull | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [item] = await db.select().from(s.contentItems).where(eq(s.contentItems.id, id));
  if (!item) return null;
  const [cats, tagRows, srcs, rels] = await Promise.all([
    db
      .select({ id: s.contentCategories.categoryId })
      .from(s.contentCategories)
      .where(eq(s.contentCategories.contentItemId, id)),
    db
      .select({ name: s.tags.name })
      .from(s.contentTags)
      .innerJoin(s.tags, eq(s.tags.id, s.contentTags.tagId))
      .where(eq(s.contentTags.contentItemId, id))
      .orderBy(asc(s.tags.name)),
    db
      .select()
      .from(s.contentSources)
      .where(eq(s.contentSources.contentItemId, id))
      .orderBy(asc(s.contentSources.sortOrder)),
    db
      .select({ slug: s.contentItems.slug })
      .from(s.contentRelations)
      .innerJoin(s.contentItems, eq(s.contentItems.id, s.contentRelations.relatedItemId))
      .where(eq(s.contentRelations.contentItemId, id)),
  ]);
  return {
    item,
    categoryIds: cats.map((c) => c.id),
    tags: tagRows.map((t) => t.name),
    relatedSlugs: rels.map((r) => r.slug),
    sources: srcs.flatMap((x) =>
      x.url
        ? [
            {
              id: x.id,
              kind: x.kind,
              url: x.url,
              sourceName: x.sourceName,
              isPrimary: x.isPrimary,
              isDownloadable: x.isDownloadable,
            },
          ]
        : [],
    ),
  };
}

/** The item exactly as the public page would render it, but regardless of status. */
export async function getContentPreview(db: AnyDb, id: string): Promise<ContentDetail | null> {
  const full = await getAdminContent(db, id);
  if (!full) return null;
  const { item } = full;
  const [type] = await db
    .select()
    .from(s.contentTypes)
    .where(eq(s.contentTypes.id, item.contentTypeId));
  const cats = full.categoryIds.length
    ? await db
        .select({ slug: s.categories.slug, name: s.categories.name })
        .from(s.categories)
        .where(inArray(s.categories.id, full.categoryIds))
    : [];
  const tagRows = await db
    .select({ slug: s.tags.slug, name: s.tags.name })
    .from(s.contentTags)
    .innerJoin(s.tags, eq(s.tags.id, s.contentTags.tagId))
    .where(eq(s.contentTags.contentItemId, id));
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    speakerName: item.speakerName,
    publishedAt: item.publishedAt,
    recordedAt: item.recordedAt,
    durationSeconds: item.durationSeconds,
    thumbnailUrl: item.thumbnailUrl,
    isFeatured: item.isFeatured,
    typeKey: type?.key ?? "",
    typeName: type?.name ?? "",
    description: item.description,
    copyrightNotice: item.copyrightNotice,
    permissionStatus: item.permissionStatus,
    reuseRestrictions: item.reuseRestrictions,
    categories: cats,
    tags: tagRows,
    sources: full.sources.map((x) => ({ ...x, originalSourceUrl: null })),
    related: [], // related items are shown only once published
  };
}

/* ───────────── Form options ───────────── */

export async function listTypeOptions(db: AnyDb) {
  return db
    .select({ id: s.contentTypes.id, name: s.contentTypes.name })
    .from(s.contentTypes)
    .where(eq(s.contentTypes.isActive, true))
    .orderBy(asc(s.contentTypes.sortOrder), asc(s.contentTypes.name));
}

export type CategoryOption = { id: string; name: string; depth: 0 | 1; isActive: boolean };

/** All categories, main ones followed by their sub-categories (two levels). */
export async function listCategoryOptions(db: AnyDb): Promise<CategoryOption[]> {
  const rows = await db
    .select()
    .from(s.categories)
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
  const out: CategoryOption[] = [];
  for (const top of rows.filter((r) => !r.parentId)) {
    out.push({ id: top.id, name: top.name, depth: 0, isActive: top.isActive });
    for (const c of rows.filter((r) => r.parentId === top.id)) {
      out.push({ id: c.id, name: c.name, depth: 1, isActive: c.isActive });
    }
  }
  return out;
}
