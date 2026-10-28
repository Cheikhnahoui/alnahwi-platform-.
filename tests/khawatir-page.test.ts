import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import * as q from "@/lib/content/queries";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
const TEXT = "السطر الأول\nالسطر الثاني\n\nالفقرة الثانية كاملة بلا اختصار.";

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
  const [khawatir] = await ctx.db
    .select()
    .from(s.contentTypes)
    .where(eq(s.contentTypes.key, "khawatir"));
  const [other] = await ctx.db
    .select()
    .from(s.contentTypes)
    .where(eq(s.contentTypes.key, "lecture"));
  const base = { isSample: true };
  await ctx.db.insert(s.contentItems).values([
    {
      ...base,
      slug: "k-old",
      title: "خاطرة أقدم",
      description: "نص أقدم",
      contentTypeId: khawatir.id,
      approvalStatus: "approved",
      publicationStatus: "published",
      publishedAt: new Date("2026-01-01"),
    },
    {
      ...base,
      slug: "k-new",
      title: "خاطرة أحدث",
      summary: "ملخص",
      description: TEXT,
      contentTypeId: khawatir.id,
      approvalStatus: "approved",
      publicationStatus: "published",
      publishedAt: new Date("2026-03-01"),
    },
    { ...base, slug: "k-draft", title: "مسودة", description: "x", contentTypeId: khawatir.id },
    {
      ...base,
      slug: "l-1",
      title: "محاضرة",
      description: "y",
      contentTypeId: other.id,
      approvalStatus: "approved",
      publicationStatus: "published",
      publishedAt: new Date("2026-02-01"),
    },
  ]);
});
afterAll(async () => ctx.client.close());

describe("listPublishedWithText (Khawatir page)", () => {
  it("returns every published post of the type, newest first, and nothing else", async () => {
    const r = await q.listPublishedWithText(ctx.db, "khawatir");
    expect(r.map((i) => i.slug)).toEqual(["k-new", "k-old"]);
  });
  it("returns the complete, unmodified text", async () => {
    const [first] = await q.listPublishedWithText(ctx.db, "khawatir");
    expect(first.title).toBe("خاطرة أحدث");
    expect(first.summary).toBe("ملخص");
    expect(first.description).toBe(TEXT);
  });
  it("returns nothing for a type with no published items", async () => {
    expect(await q.listPublishedWithText(ctx.db, "poem")).toEqual([]);
  });
});
