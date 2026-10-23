import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import * as s from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/permissions";
import type { ContentData } from "@/lib/admin/content-input";
import { parseContentForm } from "@/lib/admin/content-input";
import {
  ValidationError,
  createContent,
  deleteContent,
  getAdminContent,
  updateContent,
  type Actor,
} from "@/lib/admin/content";
import { isBlobUrl, uploadExt } from "@/lib/storage/media-types";
import { UploadError, uploadTokenOptions } from "@/lib/storage/upload-policy";
import { findAbandonedFileIds, registerStoredFile, releaseStoredFiles } from "@/lib/storage/files";
import type { FileStore } from "@/lib/storage/store";

const HOST = "https://abc123.public.blob.vercel-storage.com";
const url = (n: string) => `${HOST}/media/${n}`;

/** In-memory stand-in for the file store: remembers what exists and what was removed. */
function fakeStore(files: Record<string, { size: number; contentType: string }> = {}) {
  const removed: string[] = [];
  const store: FileStore & { removed: string[]; failRemove?: boolean } = {
    removed,
    async inspect(u) {
      const f = files[u];
      if (!f) throw new Error("not found");
      return f;
    },
    async remove(u) {
      if (store.failRemove) throw new Error("storage down");
      removed.push(u);
      delete files[u];
    },
  };
  return store;
}

describe("upload rules (pure)", () => {
  it("issues a token only for allowed files in the media folder", () => {
    const o = uploadTokenOptions("media/3f2a-lesson.mp4");
    expect(o.allowedContentTypes).toEqual(["video/mp4"]);
    expect(o.addRandomSuffix).toBe(true);
    expect(o.allowOverwrite).toBe(false);
    expect(uploadTokenOptions("media/a.MP3").allowedContentTypes).toEqual(["audio/mpeg"]);
  });
  it("refuses everything else", () => {
    for (const p of [
      "media/virus.exe",
      "media/page.html",
      "media/archive.zip",
      "other/lesson.mp4", // wrong folder
      "media/../secret.mp4", // path tricks
      "media/a/b.mp4",
      "lesson.mp4",
      "media/.mp4",
      "",
    ]) {
      expect(() => uploadTokenOptions(p), p).toThrow(UploadError);
    }
  });
  it("only accepts our own public blob host", () => {
    expect(isBlobUrl(url("a.mp4"))).toBe(true);
    for (const u of [
      "http://abc123.public.blob.vercel-storage.com/media/a.mp4",
      "https://evil.example/media/a.mp4",
      "https://public.blob.vercel-storage.com.evil.example/a.mp4",
      "https://user:pw@abc123.public.blob.vercel-storage.com/a.mp4",
      "javascript:alert(1)",
      "",
    ]) {
      expect(isBlobUrl(u), u).toBe(false);
    }
    expect(uploadExt("x/y/Lesson.MP4")).toBe("mp4");
    expect(uploadExt("x.exe")).toBeNull();
  });
  it("reads the uploaded-file id from the admin form, and rejects a malformed one", () => {
    const fd = (id: string) => {
      const f = new FormData();
      f.set("title", "عنوان");
      f.set("contentTypeId", "11111111-1111-4111-8111-111111111111");
      f.set("sources.0.kind", "video");
      f.set("sources.0.url", url("a.mp4"));
      f.set("sources.0.storedFileId", id);
      return parseContentForm(f);
    };
    const good = fd("22222222-2222-4222-8222-222222222222");
    expect(good.ok && good.data.sources[0].storedFileId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(fd("not-a-uuid").ok).toBe(false);
  });
});

describe("registering, using and releasing uploaded files", () => {
  let ctx: Awaited<ReturnType<typeof createTestDb>>;
  let typeId: string;
  let admin: Actor;

  const data = (over: Partial<ContentData> = {}): ContentData => ({
    title: "مادة",
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
  const fileSource = (u: string, fileId: string) => ({
    kind: "video" as const,
    url: u,
    sourceName: null,
    isPrimary: true,
    isDownloadable: false,
    storedFileId: fileId,
  });
  const upload = async (store: FileStore, name = "lesson.mp4") =>
    registerStoredFile(ctx.db, store, admin.id, { url: url(name), name });
  const rows = () => ctx.db.select().from(s.storedFiles);

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

  it("registers a finished upload using the size and type reported by the STORE", async () => {
    const store = fakeStore({ [url("lesson.mp4")]: { size: 5_000_000, contentType: "video/mp4" } });
    const f = await upload(store);
    expect(f.kind).toBe("video");
    expect(f.url).toBe(url("lesson.mp4"));
    const [row] = await rows();
    expect(row).toMatchObject({
      provider: "vercel_blob",
      storageKey: url("lesson.mp4"),
      mimeType: "video/mp4",
      sizeBytes: 5_000_000,
      visibility: "public",
      uploadedBy: admin.id,
    });
    // registering the same file twice does not create a second row
    expect((await upload(store)).id).toBe(f.id);
    expect(await rows()).toHaveLength(1);
  });

  it("rejects and DELETES a file whose real type or size breaks the rules", async () => {
    const store = fakeStore({
      [url("fake.mp4")]: { size: 1000, contentType: "text/html" }, // claims .mp4, is HTML
      [url("huge.mp4")]: { size: 600 * 1024 * 1024, contentType: "video/mp4" },
      [url("empty.mp4")]: { size: 0, contentType: "video/mp4" },
    });
    for (const n of ["fake.mp4", "huge.mp4", "empty.mp4"]) {
      await expect(upload(store, n), n).rejects.toBeInstanceOf(UploadError);
    }
    expect(store.removed.sort()).toEqual(
      [url("empty.mp4"), url("fake.mp4"), url("huge.mp4")].sort(),
    );
    expect((await rows()).some((r) => r.storageKey.includes("fake"))).toBe(false);
  });

  it("rejects foreign URLs, unknown extensions and files that do not exist", async () => {
    const store = fakeStore();
    for (const u of ["https://evil.example/a.mp4", url("a.exe"), url("missing.mp4")]) {
      await expect(
        registerStoredFile(ctx.db, store, admin.id, { url: u, name: "x" }),
        u,
      ).rejects.toBeInstanceOf(UploadError);
    }
  });

  it("only lets a source use a file that really matches its registered URL", async () => {
    const store = fakeStore({ [url("ok.mp4")]: { size: 10, contentType: "video/mp4" } });
    const f = await upload(store, "ok.mp4");
    const row = await createContent(
      ctx.db,
      admin,
      data({ title: "بملف", sources: [fileSource(f.url, f.id)] }),
    );
    const full = await getAdminContent(ctx.db, row.id);
    expect(full?.sources[0].storedFileId).toBe(f.id);
    expect(full?.sources[0].fileLabel).toMatch(/ok\.mp4/);

    // tampered: same file id but a different URL, an unknown id
    await expect(
      createContent(
        ctx.db,
        admin,
        data({ title: "x", sources: [fileSource("https://evil.example/a.mp4", f.id)] }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createContent(
        ctx.db,
        admin,
        data({ title: "y", sources: [fileSource(f.url, "33333333-3333-4333-8333-333333333333")] }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("reports the files an edit or a delete stops using, and releasing removes them for good", async () => {
    const store = fakeStore({
      [url("e1.mp4")]: { size: 10, contentType: "video/mp4" },
      [url("e2.mp4")]: { size: 10, contentType: "video/mp4" },
    });
    const f1 = await upload(store, "e1.mp4");
    const f2 = await upload(store, "e2.mp4");
    const item = await createContent(
      ctx.db,
      admin,
      data({ title: "تعديل", sources: [fileSource(f1.url, f1.id)] }),
    );

    // swap f1 for f2: f1 is released, f2 is not
    const upd = await updateContent(
      ctx.db,
      admin,
      item.id,
      data({ title: "تعديل", sources: [fileSource(f2.url, f2.id)] }),
    );
    expect(upd.releasedFileIds).toEqual([f1.id]);
    expect(await releaseStoredFiles(ctx.db, store, upd.releasedFileIds)).toBe(1);
    expect(store.removed).toContain(f1.url);
    expect((await rows()).some((r) => r.id === f1.id)).toBe(false);

    // deleting the item releases f2 too
    const del = await deleteContent(ctx.db, admin, item.id);
    expect(del.releasedFileIds).toEqual([f2.id]);
    await releaseStoredFiles(ctx.db, store, del.releasedFileIds);
    expect(store.removed).toContain(f2.url);
    expect((await rows()).some((r) => r.id === f2.id)).toBe(false);
  });

  it("keeps a file that another item still uses, and survives a storage outage", async () => {
    const store = fakeStore({ [url("shared.mp4")]: { size: 10, contentType: "video/mp4" } });
    const f = await upload(store, "shared.mp4");
    const a = await createContent(
      ctx.db,
      admin,
      data({ title: "أ", sources: [fileSource(f.url, f.id)] }),
    );
    await createContent(ctx.db, admin, data({ title: "ب", sources: [fileSource(f.url, f.id)] }));
    const del = await deleteContent(ctx.db, admin, a.id);
    expect(await releaseStoredFiles(ctx.db, store, del.releasedFileIds)).toBe(0);
    expect(store.removed).not.toContain(f.url);

    const lone = fakeStore({ [url("lone.mp4")]: { size: 10, contentType: "video/mp4" } });
    const g = await upload(lone, "lone.mp4");
    lone.failRemove = true;
    // must not throw: the admin's change is already saved
    await expect(releaseStoredFiles(ctx.db, lone, [g.id])).resolves.toBe(1);
  });

  it("finds uploads nobody attached after 24 hours (and only those)", async () => {
    const store = fakeStore({
      [url("old.mp4")]: { size: 10, contentType: "video/mp4" },
      [url("new.mp4")]: { size: 10, contentType: "video/mp4" },
      [url("used.mp4")]: { size: 10, contentType: "video/mp4" },
    });
    const old = await upload(store, "old.mp4");
    const fresh = await upload(store, "new.mp4");
    const used = await upload(store, "used.mp4");
    await createContent(
      ctx.db,
      admin,
      data({ title: "مستخدم", sources: [fileSource(used.url, used.id)] }),
    );
    const longAgo = new Date(Date.now() - 48 * 3_600_000);
    for (const f of [old, used]) {
      await ctx.db
        .update(s.storedFiles)
        .set({ createdAt: longAgo })
        .where(eq(s.storedFiles.id, f.id));
    }
    const found = await findAbandonedFileIds(ctx.db, 24);
    expect(found).toContain(old.id);
    expect(found).not.toContain(fresh.id); // too recent: its form may still be open
    expect(found).not.toContain(used.id); // attached to a material
  });
});
