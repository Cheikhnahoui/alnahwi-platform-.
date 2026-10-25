import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import { ROLES, type RoleKey } from "@/lib/auth/permissions";
import type { ContentData } from "@/lib/admin/content-input";
import {
  PermissionError,
  ValidationError,
  WorkflowError,
  createContent,
  transition,
  type Actor,
} from "@/lib/admin/content";
import {
  createCategory,
  deleteCategory,
  deleteTag,
  deleteUnusedTags,
  getAdminCategory,
  listAdminCategories,
  listAdminTags,
  moveCategory,
  parseCategoryForm,
  parseTagName,
  renameTag,
  setCategoryActive,
  updateCategory,
  type CategoryInput,
} from "@/lib/admin/taxonomy";
import { listCategoryTree, listContent } from "@/lib/content/queries";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let typeId: string;
const actors = {} as Record<RoleKey, Actor>;
const admin = () => actors.super_admin;

const cat = (name: string, over: Partial<CategoryInput> = {}): CategoryInput => ({
  name,
  slug: "",
  description: null,
  imageUrl: null,
  parentId: null,
  isActive: true,
  ...over,
});
const names = async () => (await listAdminCategories(ctx.db)).map((c) => c.name);

async function item(title: string, over: Partial<ContentData> = {}) {
  const row = await createContent(ctx.db, admin(), {
    title,
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
  await transition(ctx.db, admin(), row.id, "publish");
  return row;
}

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
});
afterAll(async () => ctx.client.close());

describe("form parsing", () => {
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  it("accepts a good category and trims", () => {
    const r = parseCategoryForm(fd({ name: "  الفقه ", slug: "Fiqh", isActive: "on" }));
    expect(r.ok && r.data).toMatchObject({
      name: "الفقه",
      slug: "fiqh",
      isActive: true,
      parentId: null,
    });
  });
  it("rejects bad names, slugs, image links and parents", () => {
    const bad: Record<string, string>[] = [
      { name: "" },
      { name: "ا".repeat(121) },
      { name: "x", slug: "bad slug!" },
      { name: "x", slug: "-bad" },
      { name: "x", imageUrl: "javascript:alert(1)" },
      { name: "x", parentId: "not-a-uuid" },
      { name: "x", description: "ا".repeat(501) },
    ];
    for (const o of bad) {
      expect(parseCategoryForm(fd(o)).ok, JSON.stringify(o)).toBe(false);
    }
  });
  it("normalises and limits tag names", () => {
    expect(parseTagName("  وسم   مزدوج ")).toEqual({ ok: true, name: "وسم مزدوج" });
    expect(parseTagName("   ").ok).toBe(false);
    expect(parseTagName("ا".repeat(61)).ok).toBe(false);
  });
});

describe("categories", () => {
  it("creates main and sub categories in display order, slug derived from the name", async () => {
    const a = await createCategory(ctx.db, admin(), cat("الفقه"));
    const b = await createCategory(ctx.db, admin(), cat("العقيدة"));
    await createCategory(ctx.db, admin(), cat("المعاملات", { parentId: a.id }));
    expect(a.slug).toBe("الفقه");
    expect(await names()).toEqual(["الفقه", "المعاملات", "العقيدة"]); // children follow their parent
    const list = await listAdminCategories(ctx.db);
    expect(list.find((c) => c.name === "المعاملات")).toMatchObject({ depth: 1, parentId: a.id });
    expect(list.find((c) => c.id === b.id)).toMatchObject({ depth: 0, children: 0, materials: 0 });
  });

  it("refuses duplicate slugs, three levels, self-parent and a parent that has children becoming a child", async () => {
    const [fiqh] = (await listAdminCategories(ctx.db)).filter((c) => c.name === "الفقه");
    const [sub] = (await listAdminCategories(ctx.db)).filter((c) => c.name === "المعاملات");
    const [aqeeda] = (await listAdminCategories(ctx.db)).filter((c) => c.name === "العقيدة");
    await expect(
      createCategory(ctx.db, admin(), cat("مكرر", { slug: "الفقه" })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createCategory(ctx.db, admin(), cat("حفيد", { parentId: sub.id })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateCategory(ctx.db, admin(), aqeeda.id, cat("العقيدة", { parentId: aqeeda.id })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateCategory(ctx.db, admin(), fiqh.id, cat("الفقه", { parentId: aqeeda.id })),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await names()).toEqual(["الفقه", "المعاملات", "العقيدة"]); // nothing changed
  });

  it("renaming a category refreshes the search text of its materials", async () => {
    const [aqeeda] = (await listAdminCategories(ctx.db)).filter((c) => c.name === "العقيدة");
    await item("مادة عن التوحيد", { categoryIds: [aqeeda.id] });
    expect((await listContent(ctx.db, { q: "الإيمانيات" })).total).toBe(0);
    await updateCategory(ctx.db, admin(), aqeeda.id, cat("الإيمانيات"));
    expect((await listContent(ctx.db, { q: "الإيمانيات" })).total).toBe(1);
    expect((await getAdminCategory(ctx.db, aqeeda.id))?.materials).toBe(1);
  });

  it("moves up and down, even when old sort orders are all tied", async () => {
    await ctx.db.update(s.categories).set({ sortOrder: 0 }); // simulate legacy ties
    const top = async () =>
      (await listAdminCategories(ctx.db)).filter((c) => c.depth === 0).map((c) => c.name);
    const before = await top();
    expect(before).toHaveLength(2);
    const last = (await listAdminCategories(ctx.db)).filter((c) => c.depth === 0).at(-1)!;
    expect(await moveCategory(ctx.db, admin(), last.id, "up")).toBe(true);
    expect(await top()).toEqual([...before].reverse());
    expect(await moveCategory(ctx.db, admin(), last.id, "up")).toBe(false); // already first
    expect(await moveCategory(ctx.db, admin(), last.id, "down")).toBe(true);
    expect(await top()).toEqual(before);
  });

  it("hiding removes a category from the public tree and showing brings it back", async () => {
    const c = await createCategory(ctx.db, admin(), cat("مؤقت"));
    expect((await listCategoryTree(ctx.db)).some((x) => x.id === c.id)).toBe(true);
    await setCategoryActive(ctx.db, admin(), c.id, false);
    expect((await listCategoryTree(ctx.db)).some((x) => x.id === c.id)).toBe(false);
    await setCategoryActive(ctx.db, admin(), c.id, true);
    expect((await listCategoryTree(ctx.db)).some((x) => x.id === c.id)).toBe(true);
  });

  it("deletes only an unused category without children, and explains why otherwise", async () => {
    const list = await listAdminCategories(ctx.db);
    const withKids = list.find((c) => c.name === "الفقه")!;
    const withItems = list.find((c) => c.materials > 0)!;
    await expect(deleteCategory(ctx.db, admin(), withKids.id)).rejects.toThrow(/تصنيفًا فرعيًا/);
    await expect(deleteCategory(ctx.db, admin(), withItems.id)).rejects.toThrow(/مرتبط بـ 1 مادة/);
    const free = await createCategory(ctx.db, admin(), cat("للحذف"));
    await deleteCategory(ctx.db, admin(), free.id);
    expect(await getAdminCategory(ctx.db, free.id)).toBeNull();
    await expect(deleteCategory(ctx.db, admin(), free.id)).rejects.toBeInstanceOf(WorkflowError);
    expect(await getAdminCategory(ctx.db, withKids.id)).not.toBeNull(); // the refused ones are intact
    expect(await getAdminCategory(ctx.db, withItems.id)).not.toBeNull();
  });
});

describe("tags", () => {
  it("lists usage, renames (refreshing search), refuses a clash, deletes only unused tags", async () => {
    await item("درس بالوسوم", { tags: ["قديم", "مهجور", "ثالث"] });
    let tags = await listAdminTags(ctx.db);
    expect(tags.total).toBe(3);
    expect(tags.items.every((t) => t.uses === 1)).toBe(true);

    const old = tags.items.find((t) => t.name === "قديم")!;
    const third = tags.items.find((t) => t.name === "ثالث")!;
    expect((await listContent(ctx.db, { q: "حديث" })).total).toBe(0);
    await renameTag(ctx.db, admin(), old.id, "  حديث ");
    expect((await listContent(ctx.db, { q: "حديث" })).total).toBe(1);
    await expect(renameTag(ctx.db, admin(), third.id, "حديث")).rejects.toBeInstanceOf(
      ValidationError,
    );
    // an older tag whose slug differs from its name must still block the same name
    await ctx.db.insert(s.tags).values({ slug: "legacy-slug", name: "وسم قديم الرابط" });
    await expect(renameTag(ctx.db, admin(), third.id, "وسم قديم الرابط")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await ctx.db.delete(s.tags).where(eq(s.tags.slug, "legacy-slug"));

    await expect(deleteTag(ctx.db, admin(), old.id)).rejects.toThrow(/مستخدم في 1 مادة/);
    await ctx.db.insert(s.tags).values([
      { slug: "غير-مستخدم-1", name: "غير مستخدم 1" },
      { slug: "غير-مستخدم-2", name: "غير مستخدم 2" },
    ]);
    tags = await listAdminTags(ctx.db);
    expect(tags.unused).toBe(2);
    const one = tags.items.find((t) => t.name === "غير مستخدم 1")!;
    await deleteTag(ctx.db, admin(), one.id);
    expect(await deleteUnusedTags(ctx.db, admin())).toBe(1);
    tags = await listAdminTags(ctx.db);
    expect(tags.total).toBe(3);
    expect(tags.unused).toBe(0);
    expect((await listAdminTags(ctx.db, { q: "حدي" })).items.map((t) => t.name)).toEqual(["حديث"]);
  });
});

describe("permissions and audit", () => {
  it("only roles with taxonomy.manage can change anything, and nothing changes otherwise", async () => {
    const before = await names();
    for (const key of ["editor", "reviewer"] as const) {
      await expect(createCategory(ctx.db, actors[key], cat("اختراق")), key).rejects.toBeInstanceOf(
        PermissionError,
      );
      await expect(renameTag(ctx.db, actors[key], "x", "y"), key).rejects.toBeInstanceOf(
        PermissionError,
      );
      await expect(deleteUnusedTags(ctx.db, actors[key]), key).rejects.toBeInstanceOf(
        PermissionError,
      );
    }
    expect(await names()).toEqual(before);
    await createCategory(ctx.db, actors.content_manager, cat("من مدير المحتوى")); // allowed
    expect(await names()).toContain("من مدير المحتوى");
  });

  it("writes audit entries for every kind of change", async () => {
    const logs = (await ctx.db.select().from(s.auditLogs)).filter(
      (l) => l.action === "taxonomy.update",
    );
    const ops = new Set(logs.map((l) => (l.metadata as { op?: string }).op));
    for (const op of [
      "create",
      "update",
      "move",
      "hide",
      "show",
      "delete",
      "rename",
      "delete_unused",
    ]) {
      expect(ops.has(op), op).toBe(true);
    }
    expect(logs.every((l) => l.actorId)).toBe(true);
  });
});
