import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import { ROLES, type RoleKey } from "@/lib/auth/permissions";
import { listContent } from "@/lib/content/queries";
import { parseDuration, slugify } from "@/lib/admin/slug";
import { parseContentForm, type ContentData } from "@/lib/admin/content-input";
import { toFormValues, valuesFromFormData } from "@/lib/admin/content-form-values";
import {
  PermissionError,
  ValidationError,
  WorkflowError,
  availableTransitions,
  createContent,
  getAdminContent,
  getContentPreview,
  listAdminContent,
  transition,
  updateContent,
  workflowState,
  type Actor,
} from "@/lib/admin/content";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let typeId: string;
let typeId2: string;
const actors = {} as Record<RoleKey, Actor> & { manager: Actor };
let catA: string;
let catB: string;

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}
function data(over: Partial<ContentData> = {}): ContentData {
  return {
    title: "عنوان تجريبي",
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
  };
}
const itemRow = async (id: string) =>
  (await ctx.db.select().from(s.contentItems).where(eq(s.contentItems.id, id)))[0];
const publicTotal = async () => (await listContent(ctx.db, { pageSize: 100 })).total;

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
  const types = await ctx.db.select().from(s.contentTypes).orderBy(s.contentTypes.sortOrder);
  typeId = types[0].id;
  typeId2 = types[1].id;
  for (const key of Object.keys(ROLES) as RoleKey[]) {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, key));
    const [u] = await ctx.db
      .insert(s.users)
      .values({ email: `${key}@example.org`, name: key, roleId: role.id })
      .returning({ id: s.users.id });
    actors[key] = { id: u.id, permissions: ROLES[key].permissions };
  }
  actors.manager = actors.content_manager; // short alias used throughout the tests
  catA = (await ctx.db.insert(s.categories).values({ slug: "cat-a", name: "الفقه" }).returning())[0]
    .id;
  catB = (
    await ctx.db.insert(s.categories).values({ slug: "cat-b", name: "العقيدة" }).returning()
  )[0].id;
});
afterAll(async () => ctx.client.close());

describe("slug and duration helpers", () => {
  it("keeps Arabic letters, drops diacritics and punctuation", () => {
    expect(slugify("شَرْحُ  أُصُولِ الفِقْهِ!")).toBe("شرح-أصول-الفقه");
    expect(slugify("Intro to Fiqh — Part 2")).toBe("intro-to-fiqh-part-2");
    expect(slugify("!!!")).toMatch(/^item-[0-9a-f]{6}$/);
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
  it("parses durations", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("45")).toBe(2700); // plain number = minutes
    expect(parseDuration("45:10")).toBe(2710);
    expect(parseDuration("1:25:30")).toBe(5130);
    for (const bad of ["abc", "1:75", "1:2:3:4", "-5", "99:99:99", "9999999"]) {
      expect(parseDuration(bad)).toBeUndefined();
    }
  });
});

describe("form validation (server side)", () => {
  const base = () => ({ title: "عنوان", contentTypeId: "11111111-1111-4111-8111-111111111111" });
  it("accepts a minimal form and applies defaults", () => {
    const r = parseContentForm(form(base()));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.permissionStatus).toBe("unknown");
      expect(r.data.isFeatured).toBe(false);
      expect(r.data.sources).toEqual([]);
    }
  });
  it("reports every problem with the field it belongs to", () => {
    const r = parseContentForm(
      form({
        title: " ",
        contentTypeId: "nope",
        duration: "x",
        recordedAt: "2020-13-45",
        slug: "bad slug!",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual([
        "contentTypeId",
        "duration",
        "recordedAt",
        "slug",
        "title",
      ]);
  });
  it("rejects over-long text and non-http(s) links", () => {
    const r = parseContentForm(
      form({
        ...base(),
        title: "x".repeat(201),
        summary: "y".repeat(501),
        thumbnailUrl: "javascript:alert(1)",
        "sources.0.url": "data:text/html,boom",
        "sources.1.url": "ftp://example.org/file",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toBeDefined();
      expect(r.errors.summary).toBeDefined();
      expect(r.errors.thumbnailUrl).toBeDefined();
      expect(r.errors["sources.0.url"]).toBeDefined();
      expect(r.errors["sources.1.url"]).toBeDefined();
    }
  });
  it("splits tags on commas and newlines, removing duplicates", () => {
    const r = parseContentForm(form({ ...base(), tags: "فقه، أصول,  فقه \n حديث" }));
    expect(r.ok && r.data.tags).toEqual(["فقه", "أصول", "حديث"]);
  });
  it("handles sources: skips empty rows, picks the primary, defaults to the first", () => {
    const r = parseContentForm(
      form({
        ...base(),
        "sources.0.url": "https://example.org/a",
        "sources.1.url": "",
        "sources.2.url": "https://example.org/c",
        "sources.2.isDownloadable": "on",
        primarySource: "2",
      }),
    );
    expect(r.ok && r.data.sources.map((x) => [x.url, x.isPrimary, x.isDownloadable])).toEqual([
      ["https://example.org/a", false, false],
      ["https://example.org/c", true, true],
    ]);
    const r2 = parseContentForm(form({ ...base(), "sources.0.url": "https://example.org/a" }));
    expect(r2.ok && r2.data.sources[0].isPrimary).toBe(true);
  });
});

describe("creating content", () => {
  it("creates a private draft owned by the actor, with an audit entry", async () => {
    const before = await publicTotal();
    const { id, slug } = await createContent(
      ctx.db,
      actors.editor,
      data({ title: "شرح أصول الفقه" }),
    );
    const row = await itemRow(id);
    expect(slug).toBe("شرح-أصول-الفقه");
    expect(row.approvalStatus).toBe("draft");
    expect(row.publicationStatus).toBe("unpublished");
    expect(row.createdBy).toBe(actors.editor.id);
    expect(await publicTotal()).toBe(before); // never visible to the public
    const log = await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.entityId, id));
    expect(log.map((l) => l.action)).toEqual(["content.create"]);
  });
  it("makes slugs unique and refuses an explicit slug that is taken", async () => {
    const a = await createContent(ctx.db, actors.editor, data({ title: "درس مكرر" }));
    const b = await createContent(ctx.db, actors.editor, data({ title: "درس مكرر" }));
    expect(a.slug).toBe("درس-مكرر");
    expect(b.slug).toBe("درس-مكرر-2");
    await expect(
      createContent(ctx.db, actors.editor, data({ title: "x", slug: a.slug })),
    ).rejects.toThrow(ValidationError);
  });
  it("is refused for roles without content.create", async () => {
    await expect(createContent(ctx.db, actors.reviewer, data())).rejects.toThrow(PermissionError);
  });
  it("links categories, reuses tags and makes everything searchable", async () => {
    const a = await createContent(
      ctx.db,
      actors.manager,
      data({ title: "الأول", categoryIds: [catA], tags: ["طهارة"] }),
    );
    const b = await createContent(
      ctx.db,
      actors.manager,
      data({ title: "الثاني", categoryIds: [catA, catB], tags: ["طهارة", "صلاة"] }),
    );
    const tags = await ctx.db.select().from(s.tags);
    expect(tags.filter((t) => t.name === "طهارة")).toHaveLength(1); // shared, not duplicated
    for (const x of [a, b]) await transition(ctx.db, actors.manager, x.id, "publish");
    const byTag = await listContent(ctx.db, { q: "صلاة" });
    expect(byTag.items.map((i) => i.title)).toEqual(["الثاني"]);
    const byCat = await listContent(ctx.db, { q: "العقيدة" });
    expect(byCat.items.map((i) => i.title)).toEqual(["الثاني"]);
    expect((await listContent(ctx.db, { category: "cat-a" })).total).toBe(2);
  });
  it("lets only publishers set the featured flag", async () => {
    const e = await createContent(
      ctx.db,
      actors.editor,
      data({ title: "مميز؟", isFeatured: true }),
    );
    expect((await itemRow(e.id)).isFeatured).toBe(false);
    const m = await createContent(
      ctx.db,
      actors.manager,
      data({ title: "مميز", isFeatured: true }),
    );
    expect((await itemRow(m.id)).isFeatured).toBe(true);
  });
  it("rejects unknown types, categories and related items — and leaves nothing behind", async () => {
    const count = async () => (await ctx.db.select().from(s.contentItems)).length;
    const n = await count();
    const ghost = "22222222-2222-4222-8222-222222222222";
    await expect(
      createContent(ctx.db, actors.editor, data({ contentTypeId: ghost })),
    ).rejects.toThrow(ValidationError);
    await expect(
      createContent(ctx.db, actors.editor, data({ categoryIds: [ghost] })),
    ).rejects.toThrow(ValidationError);
    await expect(
      createContent(
        ctx.db,
        actors.editor,
        data({ title: "نصف مكتملة", tags: ["وسم-جديد-يجب-ألا-يبقى"], relatedSlugs: ["لا-توجد"] }),
      ),
    ).rejects.toThrow(ValidationError);
    expect(await count()).toBe(n); // the transaction rolled back
    expect(
      (await ctx.db.select().from(s.tags)).some((t) => t.name === "وسم-جديد-يجب-ألا-يبقى"),
    ).toBe(false);
  });
  it("stores sources with one primary and links related items", async () => {
    const first = await createContent(ctx.db, actors.editor, data({ title: "مرتبطة" }));
    const { id } = await createContent(
      ctx.db,
      actors.editor,
      data({
        title: "مع مصادر",
        relatedSlugs: [first.slug],
        sources: [
          {
            kind: "video",
            url: "https://example.org/v",
            sourceName: "قناة",
            isPrimary: true,
            isDownloadable: false,
          },
          {
            kind: "file",
            url: "https://example.org/f.pdf",
            sourceName: null,
            isPrimary: false,
            isDownloadable: true,
          },
        ],
      }),
    );
    const full = await getAdminContent(ctx.db, id);
    expect(full?.sources.map((x) => [x.kind, x.isPrimary])).toEqual([
      ["video", true],
      ["file", false],
    ]);
    expect(full?.relatedSlugs).toEqual([first.slug]);
  });
});

describe("editing content", () => {
  it("replaces categories, tags and sources and refreshes the search text", async () => {
    const { id } = await createContent(
      ctx.db,
      actors.editor,
      data({ title: "قابلة للتعديل", categoryIds: [catA], tags: ["قديم"] }),
    );
    await updateContent(
      ctx.db,
      actors.editor,
      id,
      data({
        title: "قابلة للتعديل",
        categoryIds: [catB],
        tags: ["جديد"],
        sources: [
          {
            kind: "audio",
            url: "https://example.org/a",
            sourceName: null,
            isPrimary: true,
            isDownloadable: false,
          },
        ],
      }),
    );
    const full = await getAdminContent(ctx.db, id);
    expect(full?.categoryIds).toEqual([catB]);
    expect(full?.tags).toEqual(["جديد"]);
    expect(full?.sources).toHaveLength(1);
    const text = (await itemRow(id)).searchText;
    expect(text).toContain("جديد");
    expect(text).not.toContain("قديم");
    expect((await itemRow(id)).updatedBy).toBe(actors.editor.id);
  });
  it("refuses an editor on approved or published items, but allows a publisher", async () => {
    const { id } = await createContent(ctx.db, actors.editor, data({ title: "محمية بعد النشر" }));
    await transition(ctx.db, actors.manager, id, "publish");
    await expect(
      updateContent(ctx.db, actors.editor, id, data({ title: "تغيير" })),
    ).rejects.toThrow(PermissionError);
    await expect(
      updateContent(ctx.db, actors.manager, id, data({ title: "تغيير مسموح" })),
    ).resolves.toBeDefined();
    expect((await itemRow(id)).title).toBe("تغيير مسموح");
    expect((await itemRow(id)).publicationStatus).toBe("published"); // editing does not unpublish
  });
  it("refuses roles without content.edit and archived items", async () => {
    const { id } = await createContent(ctx.db, actors.editor, data({ title: "للأرشفة" }));
    await expect(updateContent(ctx.db, actors.reviewer, id, data())).rejects.toThrow(
      PermissionError,
    );
    await transition(ctx.db, actors.manager, id, "archive");
    await expect(updateContent(ctx.db, actors.manager, id, data({ title: "x" }))).rejects.toThrow(
      WorkflowError,
    );
  });
  it("checks slug uniqueness on rename and reports a missing item", async () => {
    const a = await createContent(ctx.db, actors.editor, data({ title: "اسم أول فريد" }));
    const b = await createContent(ctx.db, actors.editor, data({ title: "اسم ثانٍ فريد" }));
    await expect(
      updateContent(ctx.db, actors.editor, b.id, data({ title: "اسم ثانٍ فريد", slug: a.slug })),
    ).rejects.toThrow(ValidationError);
    await expect(
      updateContent(ctx.db, actors.editor, b.id, data({ title: "اسم ثانٍ فريد", slug: b.slug })),
    ).resolves.toBeDefined(); // own slug is fine
    await expect(
      updateContent(ctx.db, actors.editor, "33333333-3333-4333-8333-333333333333", data()),
    ).rejects.toThrow(WorkflowError);
  });
});

describe("approval and publication workflow", () => {
  it("runs draft → review → approved → published → unpublished → archived → restored", async () => {
    const { id } = await createContent(ctx.db, actors.editor, data({ title: "رحلة كاملة" }));
    const st = async () => workflowState(await itemRow(id));
    expect(await st()).toBe("draft");
    await transition(ctx.db, actors.editor, id, "submit");
    expect(await st()).toBe("in_review");
    await expect(transition(ctx.db, actors.editor, id, "approve")).rejects.toThrow(PermissionError);
    await transition(ctx.db, actors.reviewer, id, "approve");
    expect(await st()).toBe("approved");
    const before = await publicTotal();
    await expect(transition(ctx.db, actors.reviewer, id, "publish")).rejects.toThrow(
      PermissionError,
    );
    expect(await publicTotal()).toBe(before); // approved is still not public
    await transition(ctx.db, actors.manager, id, "publish");
    expect(await st()).toBe("published");
    expect((await itemRow(id)).publishedAt).not.toBeNull();
    expect(await publicTotal()).toBe(before + 1);
    await transition(ctx.db, actors.manager, id, "unpublish");
    expect(await publicTotal()).toBe(before);
    await transition(ctx.db, actors.manager, id, "publish");
    await transition(ctx.db, actors.manager, id, "archive");
    expect(await st()).toBe("archived");
    expect(await publicTotal()).toBe(before); // archived is hidden
    await transition(ctx.db, actors.manager, id, "restore");
    expect(await st()).toBe("approved");
    const log = await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.entityId, id));
    expect(log.map((l) => l.action)).toEqual(
      expect.arrayContaining([
        "content.create",
        "content.submit",
        "content.approve",
        "content.publish",
        "content.unpublish",
        "content.archive",
        "content.restore",
      ]),
    );
  });
  it("keeps the original publication date when republished", async () => {
    const { id } = await createContent(ctx.db, actors.manager, data({ title: "تاريخ ثابت" }));
    await transition(ctx.db, actors.manager, id, "publish");
    const first = (await itemRow(id)).publishedAt;
    await transition(ctx.db, actors.manager, id, "unpublish");
    await transition(ctx.db, actors.manager, id, "publish");
    expect((await itemRow(id)).publishedAt).toEqual(first);
  });
  it("lets a reviewer send an item back for changes", async () => {
    const { id } = await createContent(ctx.db, actors.editor, data({ title: "إعادة" }));
    await transition(ctx.db, actors.editor, id, "submit");
    await transition(ctx.db, actors.reviewer, id, "request_changes");
    expect(workflowState(await itemRow(id))).toBe("draft");
  });
  it("rejects transitions that do not fit the current state", async () => {
    const { id } = await createContent(ctx.db, actors.manager, data({ title: "حالات خاطئة" }));
    await expect(transition(ctx.db, actors.reviewer, id, "approve")).rejects.toThrow(WorkflowError); // a draft is not in review
    await expect(transition(ctx.db, actors.manager, id, "unpublish")).rejects.toThrow(
      WorkflowError,
    );
    await expect(transition(ctx.db, actors.manager, id, "restore")).rejects.toThrow(WorkflowError);
    await transition(ctx.db, actors.manager, id, "publish");
    await expect(transition(ctx.db, actors.manager, id, "publish")).rejects.toThrow(WorkflowError);
    await expect(transition(ctx.db, actors.editor, id, "submit")).rejects.toThrow(WorkflowError);
    await expect(
      transition(ctx.db, actors.manager, "33333333-3333-4333-8333-333333333333", "publish"),
    ).rejects.toThrow(WorkflowError);
  });
  it("honours the mandatory-review setting", async () => {
    const { id } = await createContent(ctx.db, actors.manager, data({ title: "مراجعة إلزامية" }));
    await ctx.db
      .update(s.siteSettings)
      .set({ value: true })
      .where(eq(s.siteSettings.key, "workflow.require_review"));
    await expect(transition(ctx.db, actors.manager, id, "publish")).rejects.toThrow(/اعتماد/);
    expect(availableTransitions(await itemRow(id), actors.manager, true)).not.toContain("publish");
    await transition(ctx.db, actors.manager, id, "submit");
    await transition(ctx.db, actors.manager, id, "approve");
    await expect(transition(ctx.db, actors.manager, id, "publish")).resolves.toBeDefined();
    await ctx.db
      .update(s.siteSettings)
      .set({ value: false })
      .where(eq(s.siteSettings.key, "workflow.require_review"));
    const direct = await createContent(ctx.db, actors.manager, data({ title: "نشر مباشر" }));
    await transition(ctx.db, actors.manager, direct.id, "publish"); // v1: authorised publishers may publish directly
    const log = await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.entityId, direct.id));
    expect(JSON.stringify(log.find((l) => l.action === "content.publish")?.metadata)).toContain(
      "autoApproved",
    );
  });
  it("never breaks the database rule that published means approved", async () => {
    const rows = await ctx.db.select().from(s.contentItems);
    for (const r of rows) {
      if (r.publicationStatus === "published") {
        expect(r.approvalStatus).toBe("approved");
        expect(r.publishedAt).not.toBeNull();
      }
    }
  });
  it("offers each role only the buttons it may use", async () => {
    const draft = { approvalStatus: "draft", publicationStatus: "unpublished" };
    const review = { approvalStatus: "in_review", publicationStatus: "unpublished" };
    const published = { approvalStatus: "approved", publicationStatus: "published" };
    const archived = { approvalStatus: "approved", publicationStatus: "archived" };
    expect(availableTransitions(draft, actors.editor, false)).toEqual(["submit"]);
    expect(availableTransitions(review, actors.editor, false)).toEqual([]);
    expect(availableTransitions(review, actors.reviewer, false)).toEqual([
      "approve",
      "request_changes",
    ]);
    expect(availableTransitions(draft, actors.manager, false)).toEqual([
      "submit",
      "publish",
      "archive",
    ]);
    expect(availableTransitions(draft, actors.manager, true)).toEqual(["submit", "archive"]);
    expect(availableTransitions(published, actors.manager, false)).toEqual([
      "unpublish",
      "archive",
    ]);
    expect(availableTransitions(archived, actors.manager, false)).toEqual(["restore"]);
    expect(availableTransitions(published, actors.editor, false)).toEqual([]);
  });
});

describe("admin listing and preview", () => {
  it("lists every state, filters by state, type and text, and paginates", async () => {
    const all = await listAdminContent(ctx.db, {});
    expect(all.total).toBeGreaterThan(10);
    expect(all.items.length).toBeLessThanOrEqual(20);
    const states = new Set(all.items.map((i) => workflowState(i)));
    expect(states.size).toBeGreaterThan(1); // drafts and published together
    for (const st of ["draft", "in_review", "approved", "published", "archived"]) {
      const r = await listAdminContent(ctx.db, { state: st });
      for (const i of r.items) expect(workflowState(i)).toBe(st);
    }
    expect(
      (await listAdminContent(ctx.db, { q: "رحلة كاملة" })).items.map((i) => i.title),
    ).toContain("رحلة كاملة");
    expect((await listAdminContent(ctx.db, { typeId: typeId2 })).total).toBe(0);
    const p2 = await listAdminContent(ctx.db, { page: 2 });
    expect(p2.page).toBe(2);
    const ids1 = new Set(all.items.map((i) => i.id));
    for (const i of p2.items) expect(ids1.has(i.id)).toBe(false);
  });
  it("previews an unpublished item that the public site cannot show", async () => {
    const { id } = await createContent(
      ctx.db,
      actors.editor,
      data({
        title: "معاينة",
        sources: [
          {
            kind: "video",
            url: "https://example.org/v",
            sourceName: null,
            isPrimary: true,
            isDownloadable: false,
          },
        ],
      }),
    );
    const preview = await getContentPreview(ctx.db, id);
    expect(preview?.title).toBe("معاينة");
    expect(preview?.sources).toHaveLength(1);
    expect((await listContent(ctx.db, { q: "معاينة" })).total).toBe(0);
    expect(await getContentPreview(ctx.db, "not-a-uuid")).toBeNull();
  });
});

describe("edit form round trip", () => {
  it("shows exactly what was saved: save → reopen → resubmit changes nothing", async () => {
    const { id } = await createContent(
      ctx.db,
      actors.manager,
      data({
        title: "ذهاب وإياب",
        slug: "round-trip",
        summary: "ملخص",
        description: "وصف\n\nفقرة",
        speakerName: "متحدث موثّق",
        recordedAt: new Date("2021-03-04T00:00:00Z"),
        durationSeconds: 5130,
        thumbnailUrl: "https://example.org/t.png",
        copyrightNotice: "إشعار",
        permissionStatus: "granted",
        reuseRestrictions: "قيد",
        isFeatured: true,
        categoryIds: [catA, catB],
        tags: ["أول", "ثانٍ"],
        sources: [
          {
            kind: "audio",
            url: "https://example.org/a",
            sourceName: "مصدر",
            isPrimary: false,
            isDownloadable: true,
          },
          {
            kind: "video",
            url: "https://example.org/v",
            sourceName: null,
            isPrimary: true,
            isDownloadable: false,
          },
        ],
      }),
    );
    const full = (await getAdminContent(ctx.db, id))!;
    const values = toFormValues(full);
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) {
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
      else if (v !== "") fd.set(k, v);
    }
    const parsed = parseContentForm(fd);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.title).toBe("ذهاب وإياب");
    expect(parsed.data.durationSeconds).toBe(5130);
    expect(parsed.data.recordedAt?.toISOString()).toBe("2021-03-04T00:00:00.000Z");
    expect(parsed.data.sources.map((x) => [x.kind, x.isPrimary, x.isDownloadable])).toEqual([
      ["audio", false, true],
      ["video", true, false],
    ]);
    await updateContent(ctx.db, actors.manager, id, parsed.data);
    const again = (await getAdminContent(ctx.db, id))!;
    expect(toFormValues(again)).toEqual(values);
  });
  it("refills the form from a submission without framework fields", () => {
    const fd = form({ title: "س", categoryIds: ["a", "b"], $ACTION_REF_1: "x" });
    expect(valuesFromFormData(fd)).toEqual({ title: "س", categoryIds: ["a", "b"] });
    expect(valuesFromFormData(form({ title: "س" })).categoryIds).toEqual([]);
  });
});
