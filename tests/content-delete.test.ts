import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import { ROLES, type RoleKey } from "@/lib/auth/permissions";
import { getContentBySlug, listContent } from "@/lib/content/queries";
import type { ContentData } from "@/lib/admin/content-input";
import {
  PermissionError,
  WorkflowError,
  createContent,
  deleteContent,
  transition,
  type Actor,
} from "@/lib/admin/content";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let typeId: string;
let catId: string;
const actors = {} as Record<RoleKey, Actor>;

const data = (over: Partial<ContentData> = {}): ContentData => ({
  title: "مادة للحذف",
  contentTypeId: typeId,
  summary: null,
  description: null,
  speakerName: null,
  recordedAt: null,
  durationSeconds: null,
  thumbnailUrl: null,
  copyrightNotice: null,
  permissionStatus: "unknown",
  reuseRestrictions: null,
  isFeatured: false,
  categoryIds: [],
  tags: [],
  relatedSlugs: [],
  sources: [],
  ...over,
});

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
  typeId = (await ctx.db.select().from(s.contentTypes))[0].id;
  for (const key of Object.keys(ROLES) as RoleKey[]) {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, key));
    const [u] = await ctx.db
      .insert(s.users)
      .values({ email: `${key}@example.org`, name: key, roleId: role.id })
      .returning({ id: s.users.id });
    actors[key] = { id: u.id, permissions: ROLES[key].permissions };
  }
  catId = (await ctx.db.insert(s.categories).values({ slug: "c", name: "تصنيف" }).returning())[0]
    .id;
});
afterAll(async () => ctx.client.close());

async function publishedItem(title: string, over: Partial<ContentData> = {}) {
  const row = await createContent(ctx.db, actors.super_admin, data({ title, ...over }));
  await transition(ctx.db, actors.super_admin, row.id, "publish");
  return row;
}

describe("permanent deletion", () => {
  it("removes a PUBLISHED item and its page disappears from the public site", async () => {
    const row = await publishedItem("منشورة", {
      categoryIds: [catId],
      tags: ["وسم"],
      sources: [
        {
          kind: "video",
          url: "https://youtu.be/dQw4w9WgXcQ",
          sourceName: "قناة",
          isPrimary: true,
          isDownloadable: false,
        },
      ],
    });
    expect(await getContentBySlug(ctx.db, row.slug)).not.toBeNull();
    const before = (await listContent(ctx.db, { pageSize: 100 })).total;

    await deleteContent(ctx.db, actors.super_admin, row.id);

    expect(await getContentBySlug(ctx.db, row.slug)).toBeNull();
    expect((await listContent(ctx.db, { pageSize: 100 })).total).toBe(before - 1);
    expect(await ctx.db.select().from(s.contentItems).where(eq(s.contentItems.id, row.id))).toEqual(
      [],
    );
  });

  it("takes its sources and category/tag links with it, but keeps categories and tags", async () => {
    const row = await publishedItem("روابط", {
      categoryIds: [catId],
      tags: ["باقٍ"],
      sources: [
        {
          kind: "video",
          url: "https://youtu.be/dQw4w9WgXcQ",
          sourceName: null,
          isPrimary: true,
          isDownloadable: false,
        },
      ],
    });
    await deleteContent(ctx.db, actors.super_admin, row.id);
    expect(
      await ctx.db
        .select()
        .from(s.contentSources)
        .where(eq(s.contentSources.contentItemId, row.id)),
    ).toEqual([]);
    expect(
      await ctx.db
        .select()
        .from(s.contentCategories)
        .where(eq(s.contentCategories.contentItemId, row.id)),
    ).toEqual([]);
    expect(
      await ctx.db.select().from(s.contentTags).where(eq(s.contentTags.contentItemId, row.id)),
    ).toEqual([]);
    expect((await ctx.db.select().from(s.categories)).length).toBeGreaterThan(0);
    expect((await ctx.db.select().from(s.tags)).some((t) => t.name === "باقٍ")).toBe(true);
  });

  it("leaves other items (and links pointing at them) intact", async () => {
    const keep = await publishedItem("باقية");
    const gone = await publishedItem("محذوفة", { relatedSlugs: [keep.slug] });
    await deleteContent(ctx.db, actors.super_admin, gone.id);
    const still = await getContentBySlug(ctx.db, keep.slug);
    expect(still?.title).toBe("باقية");
  });

  it("works for drafts and archived items too", async () => {
    const draft = await createContent(ctx.db, actors.super_admin, data({ title: "مسودة" }));
    await deleteContent(ctx.db, actors.super_admin, draft.id);
    const arch = await publishedItem("مؤرشفة");
    await transition(ctx.db, actors.super_admin, arch.id, "archive");
    await deleteContent(ctx.db, actors.super_admin, arch.id);
    expect(
      await ctx.db.select().from(s.contentItems).where(eq(s.contentItems.id, arch.id)),
    ).toEqual([]);
  });

  it("writes an audit entry with the title and no sensitive data", async () => {
    const row = await publishedItem("سجل الحذف");
    await deleteContent(ctx.db, actors.super_admin, row.id);
    const [log] = await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.entityId, row.id));
    const entries = (
      await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.entityId, row.id))
    ).filter((l) => l.action === "content.delete");
    expect(log).toBeDefined();
    expect(entries).toHaveLength(1);
    expect(entries[0].actorId).toBe(actors.super_admin.id);
    expect(entries[0].metadata).toEqual({ title: "سجل الحذف", slug: row.slug, state: "published" });
  });

  it("is refused for everyone except the main administrator, and nothing is deleted", async () => {
    const row = await publishedItem("محمية");
    for (const key of ["content_manager", "editor", "reviewer"] as const) {
      await expect(deleteContent(ctx.db, actors[key], row.id), key).rejects.toBeInstanceOf(
        PermissionError,
      );
    }
    expect(await getContentBySlug(ctx.db, row.slug)).not.toBeNull();
  });

  it("reports a missing item clearly, and a second delete does nothing", async () => {
    const row = await publishedItem("مرتين");
    await deleteContent(ctx.db, actors.super_admin, row.id);
    await expect(deleteContent(ctx.db, actors.super_admin, row.id)).rejects.toBeInstanceOf(
      WorkflowError,
    );
    await expect(
      deleteContent(ctx.db, actors.super_admin, "00000000-0000-4000-8000-000000000000"),
    ).rejects.toBeInstanceOf(WorkflowError);
  });
});
