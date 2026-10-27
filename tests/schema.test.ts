import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createTestDb, expectPgError } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import { buildSearchText, normalizeArabic } from "@/lib/search/arabic";

type Ctx = Awaited<ReturnType<typeof createTestDb>>;
let ctx: Ctx;
let typeId: string;
let n = 0;
const uniq = () => `t${++n}`;

async function newItem(over: Partial<typeof s.contentItems.$inferInsert> = {}) {
  const slug = uniq();
  const [row] = await ctx.db
    .insert(s.contentItems)
    .values({ title: `عنوان ${slug}`, slug, contentTypeId: typeId, isSample: true, ...over })
    .returning();
  return row;
}

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
  typeId = (await ctx.db.select().from(s.contentTypes).limit(1))[0].id;
});
afterAll(async () => ctx.client.close());

describe("reference seed", () => {
  it("creates roles, permissions and content types", async () => {
    expect((await ctx.db.select().from(s.roles)).length).toBe(4);
    expect((await ctx.db.select().from(s.contentTypes)).length).toBe(11);
  });
  it("is idempotent", async () => {
    await seedReferenceData(ctx.db);
    expect((await ctx.db.select().from(s.roles)).length).toBe(4);
    expect((await ctx.db.select().from(s.permissions)).length).toBe(15);
  });
  it("maps super_admin to all permissions and editor to three", async () => {
    const count = async (key: string) =>
      (
        await ctx.db
          .select()
          .from(s.rolePermissions)
          .innerJoin(s.roles, eq(s.roles.id, s.rolePermissions.roleId))
          .where(eq(s.roles.key, key))
      ).length;
    expect(await count("super_admin")).toBe(15);
    expect(await count("editor")).toBe(3);
  });
  it("creates static pages as unpublished and empty", async () => {
    const pages = await ctx.db.select().from(s.staticPages);
    expect(pages.length).toBe(4);
    for (const p of pages) {
      expect(p.publicationStatus).toBe("unpublished");
      expect(p.body).toBe("");
    }
  });
});

describe("publication rules", () => {
  it("rejects publishing an item that is not approved", async () => {
    await expectPgError(
      newItem({ publicationStatus: "published", approvalStatus: "draft", publishedAt: new Date() }),
      "23514",
    );
  });
  it("rejects a published item without a publication date", async () => {
    await expectPgError(
      newItem({ publicationStatus: "published", approvalStatus: "approved" }),
      "23514",
    );
  });
  it("accepts an approved + published item with a date", async () => {
    const row = await newItem({
      publicationStatus: "published",
      approvalStatus: "approved",
      publishedAt: new Date(),
    });
    expect(row.publicationStatus).toBe("published");
  });
  it("defaults new items to draft / unpublished / permission unknown", async () => {
    const row = await newItem();
    expect(row.approvalStatus).toBe("draft");
    expect(row.publicationStatus).toBe("unpublished");
    expect(row.permissionStatus).toBe("unknown");
  });
  it("allows unknown dates and durations (nullable)", async () => {
    const row = await newItem();
    expect(row.recordedAt).toBeNull();
    expect(row.durationSeconds).toBeNull();
  });
  it("rejects negative duration and duplicate slugs", async () => {
    await expectPgError(newItem({ durationSeconds: -1 }), "23514");
    const a = await newItem();
    await expectPgError(newItem({ slug: a.slug }), "23505");
  });
});

describe("relations and delete safety", () => {
  it("blocks deleting a category that is still used", async () => {
    const [cat] = await ctx.db
      .insert(s.categories)
      .values({ slug: uniq(), name: "تصنيف" })
      .returning();
    const item = await newItem();
    await ctx.db.insert(s.contentCategories).values({ contentItemId: item.id, categoryId: cat.id });
    await expectPgError(ctx.db.delete(s.categories).where(eq(s.categories.id, cat.id)), "23001");
  });
  it("blocks deleting a category that has sub-categories", async () => {
    const [parent] = await ctx.db
      .insert(s.categories)
      .values({ slug: uniq(), name: "أصل" })
      .returning();
    await ctx.db.insert(s.categories).values({ slug: uniq(), name: "فرع", parentId: parent.id });
    await expectPgError(ctx.db.delete(s.categories).where(eq(s.categories.id, parent.id)), "23001");
  });
  it("rejects a category being its own parent", async () => {
    const [c] = await ctx.db
      .insert(s.categories)
      .values({ slug: uniq(), name: "ذاتي" })
      .returning();
    await expectPgError(
      ctx.db.update(s.categories).set({ parentId: c.id }).where(eq(s.categories.id, c.id)),
      "23514",
    );
  });
  it("blocks deleting a tag that is still used", async () => {
    const [tag] = await ctx.db.insert(s.tags).values({ slug: uniq(), name: "وسم" }).returning();
    const item = await newItem();
    await ctx.db.insert(s.contentTags).values({ contentItemId: item.id, tagId: tag.id });
    await expectPgError(ctx.db.delete(s.tags).where(eq(s.tags.id, tag.id)), "23001");
  });
  it("blocks deleting a content type that is in use", async () => {
    await newItem();
    await expectPgError(
      ctx.db.delete(s.contentTypes).where(eq(s.contentTypes.id, typeId)),
      "23001",
    );
  });
  it("cascades joins and sources when an item is deleted", async () => {
    const [cat] = await ctx.db.insert(s.categories).values({ slug: uniq(), name: "ك" }).returning();
    const item = await newItem();
    await ctx.db.insert(s.contentCategories).values({ contentItemId: item.id, categoryId: cat.id });
    await ctx.db.insert(s.contentSources).values({
      contentItemId: item.id,
      kind: "external_link",
      url: "https://example.org/x",
    });
    await ctx.db.delete(s.contentItems).where(eq(s.contentItems.id, item.id));
    expect(
      await ctx.db
        .select()
        .from(s.contentCategories)
        .where(eq(s.contentCategories.contentItemId, item.id)),
    ).toHaveLength(0);
    expect(
      await ctx.db
        .select()
        .from(s.contentSources)
        .where(eq(s.contentSources.contentItemId, item.id)),
    ).toHaveLength(0);
  });
  it("rejects self-relations and duplicate relation pairs", async () => {
    const a = await newItem();
    const b = await newItem();
    await expectPgError(
      ctx.db.insert(s.contentRelations).values({ contentItemId: a.id, relatedItemId: a.id }),
      "23514",
    );
    await ctx.db.insert(s.contentRelations).values({ contentItemId: a.id, relatedItemId: b.id });
    await expectPgError(
      ctx.db.insert(s.contentRelations).values({ contentItemId: a.id, relatedItemId: b.id }),
      "23505",
    );
  });
});

describe("sources", () => {
  it("requires a URL or a stored file", async () => {
    const item = await newItem();
    await expectPgError(
      ctx.db.insert(s.contentSources).values({ contentItemId: item.id, kind: "video" }),
      "23514",
    );
  });
  it("allows only one primary source per item", async () => {
    const item = await newItem();
    const base = { contentItemId: item.id, kind: "video" as const, isPrimary: true };
    await ctx.db.insert(s.contentSources).values({ ...base, url: "https://example.org/1" });
    await expectPgError(
      ctx.db.insert(s.contentSources).values({ ...base, url: "https://example.org/2" }),
      "23505",
    );
    await ctx.db
      .insert(s.contentSources)
      .values({ ...base, isPrimary: false, url: "https://example.org/3" });
  });
});

describe("users", () => {
  it("enforces case-insensitive unique email", async () => {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, "editor"));
    await ctx.db.insert(s.users).values({ email: "A@Example.org", name: "أ", roleId: role.id });
    await expectPgError(
      ctx.db.insert(s.users).values({ email: "a@example.ORG", name: "ب", roleId: role.id }),
      "23505",
    );
  });
  it("blocks deleting a role that has users", async () => {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, "editor"));
    await expectPgError(ctx.db.delete(s.roles).where(eq(s.roles.id, role.id)), "23001");
  });
  it("keeps content when its author is deleted (created_by set null)", async () => {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, "reviewer"));
    const [u] = await ctx.db
      .insert(s.users)
      .values({ email: "x@example.org", name: "x", roleId: role.id })
      .returning();
    const item = await newItem({ createdBy: u.id });
    await ctx.db.delete(s.users).where(eq(s.users.id, u.id));
    const [after] = await ctx.db
      .select()
      .from(s.contentItems)
      .where(eq(s.contentItems.id, item.id));
    expect(after.createdBy).toBeNull();
  });
});

describe("Arabic full-text search", () => {
  it("finds items regardless of hamza/diacritics, using the GIN-indexed expression", async () => {
    const item = await newItem({
      title: "شَرْحُ أُصُولِ الفِقْهِ",
      searchText: buildSearchText("شَرْحُ أُصُولِ الفِقْهِ", "درس تمهيدي"),
    });
    const q = normalizeArabic("اصول الفقه");
    const hits = await ctx.db
      .select({ id: s.contentItems.id })
      .from(s.contentItems)
      .where(
        sql`to_tsvector('simple', ${s.contentItems.searchText}) @@ plainto_tsquery('simple', ${q})`,
      );
    expect(hits.map((h) => h.id)).toContain(item.id);
    // The stored title keeps its original diacritics.
    const [row] = await ctx.db
      .select()
      .from(s.contentItems)
      .where(and(eq(s.contentItems.id, item.id)));
    expect(row.title).toBe("شَرْحُ أُصُولِ الفِقْهِ");
  });
});

describe("audit log and settings", () => {
  it("stores audit entries and keeps them if the actor is removed", async () => {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, "reviewer"));
    const [u] = await ctx.db
      .insert(s.users)
      .values({ email: "audit@example.org", name: "m", roleId: role.id })
      .returning();
    await ctx.db.insert(s.auditLogs).values({
      actorId: u.id,
      action: "content.publish",
      entityType: "content_item",
      entityId: "1",
    });
    await ctx.db.delete(s.users).where(eq(s.users.id, u.id));
    const rows = await ctx.db
      .select()
      .from(s.auditLogs)
      .where(eq(s.auditLogs.action, "content.publish"));
    expect(rows[0].actorId).toBeNull();
  });
  it("defaults mandatory review to off but switchable", async () => {
    const [row] = await ctx.db
      .select()
      .from(s.siteSettings)
      .where(eq(s.siteSettings.key, "workflow.require_review"));
    expect(row.value).toBe(false);
  });
});
