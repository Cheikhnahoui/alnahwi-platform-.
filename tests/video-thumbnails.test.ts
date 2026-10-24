import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/permissions";
import type { ContentData, SourceInput } from "@/lib/admin/content-input";
import { createContent, transition, type Actor } from "@/lib/admin/content";
import { getContentBySlug, getHomeData, listContent } from "@/lib/content/queries";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let typeId: string;
let admin: Actor;

const ID_A = "dQw4w9WgXcQ";
const ID_B = "aqz-KE-bpKQ";
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const src = (url: string, over: Partial<SourceInput> = {}): SourceInput => ({
  kind: "video",
  url,
  sourceName: null,
  isPrimary: false,
  isDownloadable: false,
  ...over,
});

async function published(title: string, over: Partial<ContentData> = {}) {
  const row = await createContent(ctx.db, admin, {
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
  await transition(ctx.db, admin, row.id, "publish");
  return row;
}
const byTitle = async (title: string) =>
  (await listContent(ctx.db, { pageSize: 100 })).items.find((i) => i.title === title);

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
  typeId = (await ctx.db.select().from(s.contentTypes))[0].id;
  const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, "super_admin"));
  const [u] = await ctx.db
    .insert(s.users)
    .values({ email: "a@example.org", name: "a", roleId: role.id })
    .returning({ id: s.users.id });
  admin = { id: u.id, permissions: ROLES.super_admin.permissions };
});
afterAll(async () => ctx.client.close());

describe("card pictures borrowed from YouTube", () => {
  it("an item with a YouTube source and no picture of its own gets the YouTube picture", async () => {
    await published("بفيديو", { sources: [src(`https://youtu.be/${ID_A}`)] });
    expect((await byTitle("بفيديو"))?.thumbnailUrl).toBe(thumb(ID_A));
  });

  it("the picture set by the administrator always wins", async () => {
    await published("بصورة يدوية", {
      thumbnailUrl: "https://example.org/mine.jpg",
      sources: [src(`https://youtu.be/${ID_A}`)],
    });
    expect((await byTitle("بصورة يدوية"))?.thumbnailUrl).toBe("https://example.org/mine.jpg");
  });

  it("uses the PRIMARY YouTube source, else the first one", async () => {
    await published("أساسي", {
      sources: [
        src(`https://youtu.be/${ID_A}`),
        src(`https://youtu.be/${ID_B}`, { isPrimary: true }),
      ],
    });
    await published("الأول", {
      sources: [src(`https://youtu.be/${ID_B}`), src(`https://youtu.be/${ID_A}`)],
    });
    expect((await byTitle("أساسي"))?.thumbnailUrl).toBe(thumb(ID_B));
    expect((await byTitle("الأول"))?.thumbnailUrl).toBe(thumb(ID_B));
  });

  it("skips sources that are not YouTube, and files, and leaves the rest without a picture", async () => {
    await published("متنوع", {
      sources: [
        src("https://cdn.example.org/lesson.mp4"),
        src(`https://youtu.be/${ID_A}`, { kind: "file" }),
        src(`https://youtu.be/${ID_B}`),
      ],
    });
    await published("بلا يوتيوب", { sources: [src("https://cdn.example.org/lesson.mp4")] });
    await published("بلا مصادر");
    expect((await byTitle("متنوع"))?.thumbnailUrl).toBe(thumb(ID_B));
    expect((await byTitle("بلا يوتيوب"))?.thumbnailUrl).toBeNull();
    expect((await byTitle("بلا مصادر"))?.thumbnailUrl).toBeNull();
  });

  it("also applies to related items and to the featured group on the home page", async () => {
    const base = await published("مرتبط به", { sources: [src(`https://youtu.be/${ID_A}`)] });
    await published("مميز", {
      isFeatured: true,
      sources: [src(`https://youtu.be/${ID_B}`)],
      relatedSlugs: [base.slug],
    });
    const home = await getHomeData(ctx.db);
    expect(home.featured.find((i) => i.title === "مميز")?.thumbnailUrl).toBe(thumb(ID_B));
    const detail = await getContentBySlug(ctx.db, (await byTitle("مميز"))!.slug);
    expect(detail?.related.find((i) => i.title === "مرتبط به")?.thumbnailUrl).toBe(thumb(ID_A));
  });

  it("never writes anything: the stored thumbnail stays empty", async () => {
    const rows = await ctx.db
      .select()
      .from(s.contentItems)
      .where(eq(s.contentItems.title, "بفيديو"));
    expect(rows[0].thumbnailUrl).toBeNull();
  });
});
