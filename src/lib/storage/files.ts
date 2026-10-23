import { and, eq, inArray, lt, notExists } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, fileLabel, isBlobUrl, uploadExt } from "./media-types";
import { PROVIDER, type FileStore } from "./store";
import { UploadError } from "./upload-policy";

export type RegisteredFile = {
  id: string;
  url: string;
  label: string;
  kind: "video" | "audio";
};

function cleanName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  return (
    base
      .replace(/[\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 200) || "ملف"
  );
}

/**
 * Called after the browser finished uploading. Never trusts the browser: the size and type are
 * read from the store itself, and a file that breaks the rules is deleted again.
 */
export async function registerStoredFile(
  db: AnyDb,
  store: FileStore,
  actorId: string,
  input: { url: string; name: string },
): Promise<RegisteredFile> {
  if (!isBlobUrl(input.url)) throw new UploadError("رابط الملف المرفوع غير صالح.");
  const ext = uploadExt(new URL(input.url).pathname);
  if (!ext) throw new UploadError("نوع الملف غير مسموح.");
  const spec = UPLOAD_TYPES[ext];

  let info: { size: number; contentType: string };
  try {
    info = await store.inspect(input.url);
  } catch {
    throw new UploadError("لم يُعثر على الملف المرفوع. أعد المحاولة.");
  }
  const mime = info.contentType.split(";")[0].trim().toLowerCase();
  if (!spec.mimes.includes(mime) || info.size <= 0 || info.size > MAX_UPLOAD_BYTES) {
    await store.remove(input.url).catch(() => undefined); // do not keep a rejected file
    throw new UploadError("الملف المرفوع لا يطابق الصيغ أو الحجم المسموح بهما، وقد حُذف.");
  }

  await db
    .insert(s.storedFiles)
    .values({
      provider: PROVIDER,
      storageKey: input.url, // for this provider the public URL is the unique key
      originalName: cleanName(input.name),
      mimeType: mime,
      sizeBytes: info.size,
      visibility: "public",
      uploadedBy: actorId,
    })
    .onConflictDoNothing({ target: [s.storedFiles.provider, s.storedFiles.storageKey] });
  const [row] = await db
    .select()
    .from(s.storedFiles)
    .where(eq(s.storedFiles.storageKey, input.url));
  return {
    id: row.id,
    url: input.url,
    label: fileLabel(row.originalName, row.sizeBytes),
    kind: spec.kind,
  };
}

/**
 * Deletes stored files that no source uses any more (row AND the real file). Files still used by
 * another item are kept. A failure to delete the real file is logged, never thrown, so it cannot
 * undo the admin's change; `npm run storage:cleanup` retries such leftovers.
 */
export async function releaseStoredFiles(db: AnyDb, store: FileStore, ids: string[]) {
  if (!ids.length) return 0;
  const rows = await db.select().from(s.storedFiles).where(inArray(s.storedFiles.id, ids));
  let removed = 0;
  for (const row of rows) {
    const [used] = await db
      .select({ id: s.contentSources.id })
      .from(s.contentSources)
      .where(eq(s.contentSources.storedFileId, row.id))
      .limit(1);
    if (used) continue;
    await db.delete(s.storedFiles).where(eq(s.storedFiles.id, row.id));
    try {
      await store.remove(row.storageKey);
    } catch (e) {
      console.error("Could not delete the stored file:", e instanceof Error ? e.message : e);
    }
    removed++;
  }
  return removed;
}

/**
 * Files that were uploaded but never attached to a saved source (for example the admin closed
 * the page), older than `olderThanHours`. Used by `npm run storage:cleanup`.
 */
export async function findAbandonedFileIds(db: AnyDb, olderThanHours = 24): Promise<string[]> {
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000);
  const rows = await db
    .select({ id: s.storedFiles.id })
    .from(s.storedFiles)
    .where(
      and(
        eq(s.storedFiles.provider, PROVIDER),
        lt(s.storedFiles.createdAt, cutoff),
        notExists(
          db
            .select({ one: s.contentSources.id })
            .from(s.contentSources)
            .where(eq(s.contentSources.storedFileId, s.storedFiles.id)),
        ),
      ),
    );
  return rows.map((r) => r.id);
}
