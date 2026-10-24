/**
 * Administration of the static pages (about the Sheikh, privacy, terms, copyright policy).
 * The four pages are created empty and unpublished by the reference seed; this module only edits
 * them. Text is stored as typed and rendered as plain paragraphs (never as markup).
 */
import { eq } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { writeAudit } from "./audit";
import { PermissionError, ValidationError, WorkflowError, type Actor } from "./content";
import { hasPermission } from "./workflow";

export const PAGE_TITLE_MAX = 200;
export const PAGE_BODY_MAX = 50_000;

/** Display order in the admin list, and the public address of each page. */
export const MANAGED_PAGES = [
  { key: "about", path: "/about" },
  { key: "privacy", path: "/privacy" },
  { key: "terms", path: "/terms" },
  { key: "copyright_policy", path: "/copyright" },
] as const;

/** Drafts of legal pages must be reviewed before publishing; the admin screen says so. */
export const LEGAL_PAGE_KEYS: readonly string[] = ["privacy", "terms", "copyright_policy"];

export const pagePath = (key: string): string | undefined =>
  MANAGED_PAGES.find((p) => p.key === key)?.path;

export type PageIntent = "save" | "publish" | "unpublish";

export type PageInput = { title: string; body: string; intent: PageIntent };

export function parsePageForm(
  fd: FormData,
): { ok: true; data: PageInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = String(fd.get("title") ?? "").trim();
  // Browsers submit line breaks as CRLF; store them as LF so paragraph splitting is consistent.
  const body = String(fd.get("body") ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
  const rawIntent = String(fd.get("intent") ?? "save");
  const intent: PageIntent =
    rawIntent === "publish" || rawIntent === "unpublish" ? rawIntent : "save";
  if (!title) errors.title = "عنوان الصفحة مطلوب.";
  else if (title.length > PAGE_TITLE_MAX) {
    errors.title = `العنوان أطول من ${PAGE_TITLE_MAX} حرفًا.`;
  }
  if (body.length > PAGE_BODY_MAX) errors.body = `النص أطول من ${PAGE_BODY_MAX} حرف.`;
  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, data: { title, body, intent } };
}

export type ManagedPageRow = {
  id: string;
  key: string;
  title: string;
  body: string;
  published: boolean;
  updatedAt: Date;
};

function toRow(r: typeof s.staticPages.$inferSelect): ManagedPageRow {
  return {
    id: r.id,
    key: r.key,
    title: r.title,
    body: r.body,
    published: r.publicationStatus === "published",
    updatedAt: r.updatedAt,
  };
}

export async function listManagedPages(db: AnyDb): Promise<ManagedPageRow[]> {
  const rows = await db.select().from(s.staticPages);
  const order = (k: string) => {
    const i = MANAGED_PAGES.findIndex((p) => p.key === k);
    return i === -1 ? MANAGED_PAGES.length : i;
  };
  return rows
    .filter((r) => MANAGED_PAGES.some((p) => p.key === r.key))
    .sort((a, b) => order(a.key) - order(b.key))
    .map(toRow);
}

export async function getManagedPage(db: AnyDb, key: string): Promise<ManagedPageRow | null> {
  if (!MANAGED_PAGES.some((p) => p.key === key)) return null;
  const [row] = await db.select().from(s.staticPages).where(eq(s.staticPages.key, key));
  return row ? toRow(row) : null;
}

/**
 * Saves a page, optionally publishing or unpublishing it in the same step.
 * A published page must have text: an empty published page would show visitors an error.
 */
export async function savePage(db: AnyDb, actor: Actor, key: string, input: PageInput) {
  if (!hasPermission(actor, "pages.edit")) {
    throw new PermissionError("ليست لديك صلاحية تعديل الصفحات.");
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.staticPages).where(eq(s.staticPages.key, key));
    if (!row || !MANAGED_PAGES.some((p) => p.key === key)) {
      throw new WorkflowError("الصفحة غير موجودة.");
    }
    const published =
      input.intent === "publish"
        ? true
        : input.intent === "unpublish"
          ? false
          : row.publicationStatus === "published";
    if (published && !input.body) {
      throw new ValidationError({
        body: "لا يمكن نشر صفحة بلا نص. اكتب النص أولًا، أو ألغِ نشر الصفحة.",
      });
    }
    await tx
      .update(s.staticPages)
      .set({
        title: input.title,
        body: input.body,
        publicationStatus: published ? "published" : "unpublished",
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(s.staticPages.id, row.id));
    await writeAudit(tx, {
      actorId: actor.id,
      action: "page.update",
      entityType: "static_page",
      entityId: row.id,
      // The text itself is not copied into the log.
      metadata: {
        key,
        published,
        wasPublished: row.publicationStatus === "published",
        length: input.body.length,
      },
    });
    return { key, published, id: row.id };
  });
}
