/**
 * Administration of categories (two levels: main and sub) and tags.
 * Every change needs `taxonomy.manage` and is written to the audit log. Nothing that is still in
 * use is ever deleted: the database also refuses it (ON DELETE RESTRICT) as a second barrier.
 */
import { and, asc, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { refreshSearchText } from "@/lib/content/search-text";
import { safeHttpUrl } from "@/lib/format";
import { writeAudit } from "./audit";
import { PermissionError, ValidationError, WorkflowError, type Actor } from "./content";
import { SLUG_RE, slugify } from "./slug";
import { hasPermission } from "./workflow";

export const NAME_MAX = 120;
export const DESCRIPTION_MAX = 500;
const STEP = 10; // sort_order gap between siblings

function assertCan(actor: Actor) {
  if (!hasPermission(actor, "taxonomy.manage")) {
    throw new PermissionError("ليست لديك صلاحية إدارة التصنيفات والوسوم.");
  }
}

/* ───────────── Input ───────────── */

export type CategoryInput = {
  name: string;
  slug: string; // "" = derive from the name
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCategoryForm(
  fd: FormData,
): { ok: true; data: CategoryInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const name = str("name");
  const slug = str("slug").toLowerCase();
  const description = str("description");
  const image = str("imageUrl");
  const parent = str("parentId");
  if (!name) errors.name = "اسم التصنيف مطلوب.";
  else if (name.length > NAME_MAX) errors.name = `الاسم أطول من ${NAME_MAX} حرفًا.`;
  if (slug && (slug.length > 80 || !SLUG_RE.test(slug))) {
    errors.slug = "الرابط حروف وأرقام مفصولة بشرطة واحدة فقط، ولا يتجاوز 80 حرفًا.";
  }
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `الوصف أطول من ${DESCRIPTION_MAX} حرف.`;
  }
  const imageUrl = image ? safeHttpUrl(image) : null;
  if (image && !imageUrl) errors.imageUrl = "رابط الصورة يجب أن يبدأ بـ https:// أو http://.";
  if (parent && !UUID.test(parent)) errors.parentId = "التصنيف الأب غير صالح.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      name,
      slug,
      description: description || null,
      imageUrl,
      parentId: parent || null,
      isActive: fd.get("isActive") === "on",
    },
  };
}

export function parseTagName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return { ok: false, error: "اسم الوسم مطلوب." };
  if (name.length > 60) return { ok: false, error: "اسم الوسم أطول من 60 حرفًا." };
  return { ok: true, name };
}

/* ───────────── Reads ───────────── */

export type AdminCategory = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  materials: number; // every linked material, in any state
  children: number;
  depth: 0 | 1;
};

/** All categories as a flat list in display order: each main category followed by its children. */
export async function listAdminCategories(db: AnyDb): Promise<AdminCategory[]> {
  const rows = await db
    .select()
    .from(s.categories)
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
  const used = await db
    .select({ id: s.contentCategories.categoryId, n: count() })
    .from(s.contentCategories)
    .groupBy(s.contentCategories.categoryId);
  const usedMap = new Map(used.map((u) => [u.id, Number(u.n)]));
  const make = (r: (typeof rows)[number], depth: 0 | 1): AdminCategory => ({
    id: r.id,
    parentId: r.parentId,
    slug: r.slug,
    name: r.name,
    description: r.description,
    imageUrl: r.imageUrl,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    materials: usedMap.get(r.id) ?? 0,
    children: rows.filter((c) => c.parentId === r.id).length,
    depth,
  });
  const out: AdminCategory[] = [];
  for (const top of rows.filter((r) => !r.parentId)) {
    out.push(make(top, 0));
    for (const c of rows.filter((r) => r.parentId === top.id)) out.push(make(c, 1));
  }
  return out;
}

export async function getAdminCategory(db: AnyDb, id: string): Promise<AdminCategory | null> {
  if (!UUID.test(id)) return null;
  return (await listAdminCategories(db)).find((c) => c.id === id) ?? null;
}

export type AdminTag = { id: string; slug: string; name: string; uses: number };
export const TAGS_PAGE_SIZE = 100;

export async function listAdminTags(
  db: AnyDb,
  opts: { q?: string; page?: number } = {},
): Promise<{ items: AdminTag[]; total: number; unused: number; page: number }> {
  const q = (opts.q ?? "").trim();
  const page = Math.max(1, opts.page ?? 1);
  const where = q
    ? sql`${s.tags.name} ilike ${"%" + q.replace(/[%_\\]/g, "\\$&") + "%"}`
    : undefined;
  const uses = sql<number>`(select count(*) from ${s.contentTags} where ${s.contentTags.tagId} = ${s.tags.id})`;
  const [total] = await db.select({ n: count() }).from(s.tags).where(where);
  const [unused] = await db
    .select({ n: count() })
    .from(s.tags)
    .where(
      sql`not exists (select 1 from ${s.contentTags} where ${s.contentTags.tagId} = ${s.tags.id})`,
    );
  const rows = await db
    .select({ id: s.tags.id, slug: s.tags.slug, name: s.tags.name, uses })
    .from(s.tags)
    .where(where)
    .orderBy(asc(s.tags.name))
    .limit(TAGS_PAGE_SIZE)
    .offset((page - 1) * TAGS_PAGE_SIZE);
  return {
    items: rows.map((r) => ({ ...r, uses: Number(r.uses) })),
    total: Number(total.n),
    unused: Number(unused.n),
    page,
  };
}

/* ───────────── Category writes ───────────── */

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";

/** Checks the parent rule: a category may sit under a MAIN category only, never under itself. */
async function checkParent(db: AnyDb, selfId: string | null, parentId: string | null) {
  if (!parentId) return;
  if (parentId === selfId) {
    throw new ValidationError({ parentId: "لا يمكن أن يكون التصنيف أبًا لنفسه." });
  }
  const [parent] = await db.select().from(s.categories).where(eq(s.categories.id, parentId));
  if (!parent) throw new ValidationError({ parentId: "التصنيف الأب غير موجود." });
  if (parent.parentId) {
    throw new ValidationError({
      parentId: "التصنيفات على مستويين فقط: اختر تصنيفًا رئيسيًا أبًا.",
    });
  }
  if (selfId) {
    const [kids] = await db
      .select({ n: count() })
      .from(s.categories)
      .where(eq(s.categories.parentId, selfId));
    if (Number(kids.n) > 0) {
      throw new ValidationError({
        parentId: "هذا التصنيف يحوي تصنيفات فرعية، فلا يمكن جعله فرعيًا. انقل فروعه أولًا.",
      });
    }
  }
}

async function uniqueSlug(db: AnyDb, wanted: string, selfId: string | null): Promise<string> {
  const [clash] = await db
    .select({ id: s.categories.id })
    .from(s.categories)
    .where(
      selfId
        ? and(eq(s.categories.slug, wanted), ne(s.categories.id, selfId))
        : eq(s.categories.slug, wanted),
    );
  if (clash)
    throw new ValidationError({ slug: "هذا الرابط مستخدم لتصنيف آخر. اختر رابطًا مختلفًا." });
  return wanted;
}

async function nextSortOrder(db: AnyDb, parentId: string | null): Promise<number> {
  const [row] = await db
    .select({ m: sql<number>`coalesce(max(${s.categories.sortOrder}), 0)` })
    .from(s.categories)
    .where(parentId ? eq(s.categories.parentId, parentId) : isNull(s.categories.parentId));
  return Number(row.m) + STEP;
}

async function refreshItemsOfCategory(db: AnyDb, categoryId: string) {
  const items = await db
    .select({ id: s.contentCategories.contentItemId })
    .from(s.contentCategories)
    .where(eq(s.contentCategories.categoryId, categoryId));
  for (const i of items) await refreshSearchText(db, i.id);
}

export async function createCategory(db: AnyDb, actor: Actor, input: CategoryInput) {
  assertCan(actor);
  try {
    return await db.transaction(async (tx) => {
      await checkParent(tx, null, input.parentId);
      const slug = await uniqueSlug(tx, input.slug || slugify(input.name), null);
      const [row] = await tx
        .insert(s.categories)
        .values({
          name: input.name,
          slug,
          description: input.description,
          imageUrl: input.imageUrl,
          parentId: input.parentId,
          isActive: input.isActive,
          sortOrder: await nextSortOrder(tx, input.parentId),
        })
        .returning({ id: s.categories.id });
      await writeAudit(tx, {
        actorId: actor.id,
        action: "taxonomy.update",
        entityType: "category",
        entityId: row.id,
        metadata: { op: "create", name: input.name },
      });
      return { id: row.id, slug };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError({ slug: "هذا الرابط مستخدم لتصنيف آخر." });
    throw e;
  }
}

export async function updateCategory(db: AnyDb, actor: Actor, id: string, input: CategoryInput) {
  assertCan(actor);
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.select().from(s.categories).where(eq(s.categories.id, id));
      if (!row) throw new WorkflowError("التصنيف غير موجود.");
      await checkParent(tx, id, input.parentId);
      const slug = await uniqueSlug(tx, input.slug || row.slug, id);
      const moved = (row.parentId ?? null) !== input.parentId;
      await tx
        .update(s.categories)
        .set({
          name: input.name,
          slug,
          description: input.description,
          imageUrl: input.imageUrl,
          parentId: input.parentId,
          isActive: input.isActive,
          // a category moved under another parent goes to the end of its new siblings
          ...(moved ? { sortOrder: await nextSortOrder(tx, input.parentId) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(s.categories.id, id));
      if (row.name !== input.name) await refreshItemsOfCategory(tx, id);
      await writeAudit(tx, {
        actorId: actor.id,
        action: "taxonomy.update",
        entityType: "category",
        entityId: id,
        metadata: { op: "update", name: input.name, slugChanged: slug !== row.slug },
      });
      return { id, slug, slugChanged: slug !== row.slug };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError({ slug: "هذا الرابط مستخدم لتصنيف آخر." });
    throw e;
  }
}

/** Moves a category one place up or down among its siblings. */
export async function moveCategory(
  db: AnyDb,
  actor: Actor,
  id: string,
  direction: "up" | "down",
): Promise<boolean> {
  assertCan(actor);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.categories).where(eq(s.categories.id, id));
    if (!row) throw new WorkflowError("التصنيف غير موجود.");
    const siblings = await tx
      .select({ id: s.categories.id })
      .from(s.categories)
      .where(row.parentId ? eq(s.categories.parentId, row.parentId) : isNull(s.categories.parentId))
      .orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
    const ids = siblings.map((x) => x.id);
    const from = ids.indexOf(id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= ids.length) return false; // already first / last
    [ids[from], ids[to]] = [ids[to], ids[from]];
    // Rewrite the whole sequence: sort_order may be tied (all zero) in old data.
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(s.categories)
        .set({ sortOrder: (i + 1) * STEP })
        .where(eq(s.categories.id, ids[i]));
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: "taxonomy.update",
      entityType: "category",
      entityId: id,
      metadata: { op: "move", direction },
    });
    return true;
  });
}

export async function setCategoryActive(db: AnyDb, actor: Actor, id: string, active: boolean) {
  assertCan(actor);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.categories).where(eq(s.categories.id, id));
    if (!row) throw new WorkflowError("التصنيف غير موجود.");
    await tx
      .update(s.categories)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(s.categories.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "taxonomy.update",
      entityType: "category",
      entityId: id,
      metadata: { op: active ? "show" : "hide", name: row.name },
    });
  });
}

/** Deletes a category only when nothing depends on it. Otherwise explains what to do instead. */
export async function deleteCategory(db: AnyDb, actor: Actor, id: string) {
  assertCan(actor);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.categories).where(eq(s.categories.id, id));
    if (!row) throw new WorkflowError("التصنيف غير موجود أو حُذف من قبل.");
    const [kids] = await tx
      .select({ n: count() })
      .from(s.categories)
      .where(eq(s.categories.parentId, id));
    if (Number(kids.n) > 0) {
      throw new WorkflowError(
        `لا يمكن حذف «${row.name}» لأن فيه ${Number(kids.n)} تصنيفًا فرعيًا. احذف فروعه أو انقلها أولًا، أو أخفِ التصنيف.`,
      );
    }
    const [used] = await tx
      .select({ n: count() })
      .from(s.contentCategories)
      .where(eq(s.contentCategories.categoryId, id));
    if (Number(used.n) > 0) {
      throw new WorkflowError(
        `لا يمكن حذف «${row.name}» لأنه مرتبط بـ ${Number(used.n)} مادة. أخفِ التصنيف بدل حذفه، أو أزله من المواد أولًا.`,
      );
    }
    await tx.delete(s.categories).where(eq(s.categories.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "taxonomy.update",
      entityType: "category",
      entityId: id,
      metadata: { op: "delete", name: row.name, slug: row.slug },
    });
    return { slug: row.slug };
  });
}

/* ───────────── Tag writes ───────────── */

export async function renameTag(db: AnyDb, actor: Actor, id: string, rawName: string) {
  assertCan(actor);
  const parsed = parseTagName(rawName);
  if (!parsed.ok) throw new ValidationError({ name: parsed.error });
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.select().from(s.tags).where(eq(s.tags.id, id));
      if (!row) throw new WorkflowError("الوسم غير موجود.");
      const slug = slugify(parsed.name);
      // Same address OR the same name (ignoring case): an older tag may have a different slug.
      const [clash] = await tx
        .select({ id: s.tags.id })
        .from(s.tags)
        .where(
          and(
            ne(s.tags.id, id),
            or(eq(s.tags.slug, slug), sql`lower(${s.tags.name}) = lower(${parsed.name})`),
          ),
        );
      if (clash) {
        throw new ValidationError({ name: "يوجد وسم آخر بهذا الاسم. اختر اسمًا مختلفًا." });
      }
      await tx.update(s.tags).set({ name: parsed.name, slug }).where(eq(s.tags.id, id));
      const items = await tx
        .select({ id: s.contentTags.contentItemId })
        .from(s.contentTags)
        .where(eq(s.contentTags.tagId, id));
      for (const i of items) await refreshSearchText(tx, i.id);
      await writeAudit(tx, {
        actorId: actor.id,
        action: "taxonomy.update",
        entityType: "tag",
        entityId: id,
        metadata: { op: "rename", from: row.name, to: parsed.name },
      });
      return { id };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ValidationError({ name: "يوجد وسم آخر بهذا الاسم." });
    }
    throw e;
  }
}

export async function deleteTag(db: AnyDb, actor: Actor, id: string) {
  assertCan(actor);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.tags).where(eq(s.tags.id, id));
    if (!row) throw new WorkflowError("الوسم غير موجود أو حُذف من قبل.");
    const [used] = await tx
      .select({ n: count() })
      .from(s.contentTags)
      .where(eq(s.contentTags.tagId, id));
    if (Number(used.n) > 0) {
      throw new WorkflowError(
        `لا يمكن حذف الوسم «${row.name}» لأنه مستخدم في ${Number(used.n)} مادة. أزله من المواد أولًا.`,
      );
    }
    await tx.delete(s.tags).where(eq(s.tags.id, id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "taxonomy.update",
      entityType: "tag",
      entityId: id,
      metadata: { op: "delete", name: row.name },
    });
  });
}

/** Deletes every tag that no material uses. Returns how many were removed. */
export async function deleteUnusedTags(db: AnyDb, actor: Actor): Promise<number> {
  assertCan(actor);
  return db.transaction(async (tx) => {
    const unused = await tx
      .select({ id: s.tags.id })
      .from(s.tags)
      .where(
        sql`not exists (select 1 from ${s.contentTags} where ${s.contentTags.tagId} = ${s.tags.id})`,
      );
    if (!unused.length) return 0;
    await tx.delete(s.tags).where(
      inArray(
        s.tags.id,
        unused.map((u) => u.id),
      ),
    );
    await writeAudit(tx, {
      actorId: actor.id,
      action: "taxonomy.update",
      entityType: "tag",
      entityId: null,
      metadata: { op: "delete_unused", removed: unused.length },
    });
    return unused.length;
  });
}
