import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import { ROLES, type RoleKey } from "@/lib/auth/permissions";
import { PermissionError, ValidationError, WorkflowError, type Actor } from "@/lib/admin/content";
import {
  PAGE_BODY_MAX,
  getManagedPage,
  listManagedPages,
  pagePath,
  parsePageForm,
  savePage,
} from "@/lib/admin/pages";
import { getPublishedPage, listPublishedPageLinks } from "@/lib/content/queries";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
const actors = {} as Record<RoleKey, Actor>;

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
  for (const key of Object.keys(ROLES) as RoleKey[]) {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, key));
    const [u] = await ctx.db
      .insert(s.users)
      .values({ email: `${key}@example.org`, name: key, roleId: role.id })
      .returning({ id: s.users.id });
    actors[key] = { id: u.id, permissions: ROLES[key].permissions };
  }
});
afterAll(async () => ctx.client.close());

describe("parsePageForm", () => {
  it("trims, normalises line breaks and reads the intent", () => {
    const r = parsePageForm(
      fd({ title: "  عن الشيخ ", body: "  أ\r\n\r\nب\r\n ", intent: "publish" }),
    );
    expect(r.ok && r.data).toEqual({ title: "عن الشيخ", body: "أ\n\nب", intent: "publish" });
  });
  it("treats an unknown intent as a plain save", () => {
    const r = parsePageForm(fd({ title: "ت", body: "", intent: "hack" }));
    expect(r.ok && r.data.intent).toBe("save");
  });
  it("rejects an empty or too long title and a too long body", () => {
    expect(parsePageForm(fd({ title: "  ", body: "" })).ok).toBe(false);
    expect(parsePageForm(fd({ title: "ا".repeat(201), body: "" })).ok).toBe(false);
    const r = parsePageForm(fd({ title: "ت", body: "ا".repeat(PAGE_BODY_MAX + 1) }));
    expect(!r.ok && r.errors.body).toBeTruthy();
  });
});

describe("static pages administration", () => {
  it("lists the four pages in a fixed order, all empty and unpublished at first", async () => {
    const pages = await listManagedPages(ctx.db);
    expect(pages.map((p) => p.key)).toEqual(["about", "privacy", "terms", "copyright_policy"]);
    expect(pages.every((p) => !p.published && p.body === "")).toBe(true);
    expect(pagePath("about")).toBe("/about");
    expect(pagePath("nope")).toBeUndefined();
  });

  it("saving a draft keeps the page hidden from visitors", async () => {
    await savePage(ctx.db, actors.super_admin, "about", {
      title: "التعريف بالشيخ",
      body: "فقرة أولى.\n\nفقرة ثانية.",
      intent: "save",
    });
    const page = await getManagedPage(ctx.db, "about");
    expect(page).toMatchObject({
      title: "التعريف بالشيخ",
      body: "فقرة أولى.\n\nفقرة ثانية.",
      published: false,
    });
    expect(await getPublishedPage(ctx.db, "about")).toBeNull();
    expect(await listPublishedPageLinks(ctx.db)).toEqual([]);
  });

  it("publishing makes the page (and its footer link) visible, unpublishing hides it again", async () => {
    await savePage(ctx.db, actors.content_manager, "about", {
      title: "التعريف بالشيخ",
      body: "نص موثق.",
      intent: "publish",
    });
    const live = await getPublishedPage(ctx.db, "about");
    expect(live).toMatchObject({ key: "about", title: "التعريف بالشيخ", body: "نص موثق." });
    expect((await listPublishedPageLinks(ctx.db)).map((l) => l.key)).toContain("about");

    await savePage(ctx.db, actors.content_manager, "about", {
      title: "التعريف بالشيخ",
      body: "نص موثق.",
      intent: "unpublish",
    });
    expect(await getPublishedPage(ctx.db, "about")).toBeNull();
    expect((await getManagedPage(ctx.db, "about"))?.body).toBe("نص موثق."); // text is kept
  });

  it("never lets a page be published, or left published, without text", async () => {
    await expect(
      savePage(ctx.db, actors.super_admin, "privacy", { title: "ت", body: "", intent: "publish" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await getManagedPage(ctx.db, "privacy"))?.published).toBe(false);

    await savePage(ctx.db, actors.super_admin, "terms", {
      title: "الشروط",
      body: "نص.",
      intent: "publish",
    });
    await expect(
      savePage(ctx.db, actors.super_admin, "terms", { title: "الشروط", body: "", intent: "save" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await getManagedPage(ctx.db, "terms"))?.body).toBe("نص."); // the failed save changed nothing
  });

  it("stores markup-looking text as plain text, untouched", async () => {
    const evil = "<script>alert(1)</script> <b>x</b> \"q\" 'q'";
    await savePage(ctx.db, actors.super_admin, "copyright_policy", {
      title: "حقوق النشر",
      body: evil,
      intent: "save",
    });
    expect((await getManagedPage(ctx.db, "copyright_policy"))?.body).toBe(evil);
  });

  it("is refused for roles without pages.edit, and nothing changes", async () => {
    for (const key of ["editor", "reviewer"] as const) {
      await expect(
        savePage(ctx.db, actors[key], "about", { title: "اختراق", body: "x", intent: "publish" }),
        key,
      ).rejects.toBeInstanceOf(PermissionError);
    }
    expect((await getManagedPage(ctx.db, "about"))?.title).toBe("التعريف بالشيخ");
  });

  it("rejects unknown pages", async () => {
    await expect(
      savePage(ctx.db, actors.super_admin, "nope", { title: "ت", body: "x", intent: "save" }),
    ).rejects.toBeInstanceOf(WorkflowError);
    expect(await getManagedPage(ctx.db, "nope")).toBeNull();
  });

  it("writes an audit entry without copying the text", async () => {
    await savePage(ctx.db, actors.super_admin, "about", {
      title: "التعريف بالشيخ",
      body: "نص سري للاختبار",
      intent: "save",
    });
    const [page] = await ctx.db.select().from(s.staticPages).where(eq(s.staticPages.key, "about"));
    const logs = (
      await ctx.db.select().from(s.auditLogs).where(eq(s.auditLogs.entityId, page.id))
    ).filter((l) => l.action === "page.update");
    expect(logs.length).toBeGreaterThan(0);
    const last = logs.at(-1)!;
    expect(last.entityType).toBe("static_page");
    expect(last.actorId).toBe(actors.super_admin.id);
    expect(JSON.stringify(last.metadata)).not.toContain("نص سري");
    expect(page.updatedBy).toBe(actors.super_admin.id);
  });
});
