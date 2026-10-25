"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { PermissionError, ValidationError, WorkflowError, type Actor } from "@/lib/admin/content";
import {
  createCategory,
  deleteCategory,
  deleteTag,
  deleteUnusedTags,
  moveCategory,
  parseCategoryForm,
  renameTag,
  setCategoryActive,
  updateCategory,
} from "@/lib/admin/taxonomy";

export type TaxonomyActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Changes on every failed submit so the form re-renders with what was typed. */
  nonce?: string;
};

const actorOf = (u: Actor): Actor => ({ id: u.id, permissions: u.permissions });

/** The public site lists categories on the home page, in the library filter and on /categories. */
function refreshPublicSite() {
  updateTag("content");
  for (const p of ["/", "/library", "/categories", "/admin/categories", "/admin/tags"]) {
    revalidatePath(p);
  }
}

function toState(e: unknown, values?: Record<string, string>): TaxonomyActionState {
  const base = { values, nonce: crypto.randomUUID() };
  if (e instanceof ValidationError) return { ...base, errors: e.errors };
  if (e instanceof PermissionError || e instanceof WorkflowError) {
    return { ...base, message: e.message };
  }
  console.error("Taxonomy action failed:", e instanceof Error ? e.message : e);
  return { ...base, message: "تعذّر تنفيذ العملية الآن. حاول مرة أخرى." };
}

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const formValues = (fd: FormData): Record<string, string> =>
  Object.fromEntries(
    ["name", "slug", "description", "imageUrl", "parentId", "isActive"].map((k) => [
      k,
      text(fd, k),
    ]),
  );

/* ───────────── Categories ───────────── */

export async function createCategoryAction(
  _prev: TaxonomyActionState,
  fd: FormData,
): Promise<TaxonomyActionState> {
  const user = await requirePermission("taxonomy.manage");
  const parsed = parseCategoryForm(fd);
  if (!parsed.ok)
    return { errors: parsed.errors, values: formValues(fd), nonce: crypto.randomUUID() };
  try {
    await createCategory(getDb(), actorOf(user), parsed.data);
  } catch (e) {
    return toState(e, formValues(fd));
  }
  refreshPublicSite();
  redirect("/admin/categories?done=created"); // outside try/catch: redirect() throws
}

export async function updateCategoryAction(
  _prev: TaxonomyActionState,
  fd: FormData,
): Promise<TaxonomyActionState> {
  const user = await requirePermission("taxonomy.manage");
  const id = text(fd, "id");
  const parsed = parseCategoryForm(fd);
  if (!parsed.ok)
    return { errors: parsed.errors, values: formValues(fd), nonce: crypto.randomUUID() };
  let slugChanged = false;
  try {
    ({ slugChanged } = await updateCategory(getDb(), actorOf(user), id, parsed.data));
  } catch (e) {
    return toState(e, formValues(fd));
  }
  refreshPublicSite();
  redirect(`/admin/categories/${id}?done=${slugChanged ? "saved_slug" : "saved"}`);
}

export async function moveCategoryAction(fd: FormData): Promise<void> {
  const user = await requirePermission("taxonomy.manage");
  const dir = text(fd, "direction") === "up" ? "up" : "down";
  try {
    await moveCategory(getDb(), actorOf(user), text(fd, "id"), dir);
  } catch (e) {
    console.error("Move failed:", e instanceof Error ? e.message : e);
  }
  refreshPublicSite();
  redirect("/admin/categories");
}

export async function toggleCategoryAction(fd: FormData): Promise<void> {
  const user = await requirePermission("taxonomy.manage");
  try {
    await setCategoryActive(getDb(), actorOf(user), text(fd, "id"), text(fd, "active") === "1");
  } catch (e) {
    console.error("Toggle failed:", e instanceof Error ? e.message : e);
  }
  refreshPublicSite();
  redirect("/admin/categories");
}

export async function deleteCategoryAction(
  _prev: TaxonomyActionState,
  fd: FormData,
): Promise<TaxonomyActionState> {
  const user = await requirePermission("taxonomy.manage");
  try {
    await deleteCategory(getDb(), actorOf(user), text(fd, "id"));
  } catch (e) {
    return toState(e);
  }
  refreshPublicSite();
  redirect("/admin/categories?done=deleted");
}

/* ───────────── Tags ───────────── */

/** Back to the same filtered page of the tag list. */
function tagsUrl(fd: FormData, extra: Record<string, string>) {
  const p = new URLSearchParams();
  const q = text(fd, "q").trim();
  const page = text(fd, "page");
  if (q) p.set("q", q.slice(0, 100));
  if (/^[1-9]\d{0,3}$/.test(page) && page !== "1") p.set("page", page);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return `/admin/tags${s ? `?${s}` : ""}`;
}

export async function renameTagAction(fd: FormData): Promise<void> {
  const user = await requirePermission("taxonomy.manage");
  let result = "renamed";
  try {
    await renameTag(getDb(), actorOf(user), text(fd, "id"), text(fd, "name"));
  } catch (e) {
    result =
      e instanceof ValidationError
        ? "name_error"
        : e instanceof WorkflowError
          ? "missing"
          : "failed";
    if (result === "failed") console.error("Rename failed:", e instanceof Error ? e.message : e);
  }
  refreshPublicSite();
  redirect(tagsUrl(fd, result === "renamed" ? { done: "renamed" } : { e: result }));
}

export async function deleteTagAction(
  _prev: TaxonomyActionState,
  fd: FormData,
): Promise<TaxonomyActionState> {
  const user = await requirePermission("taxonomy.manage");
  try {
    await deleteTag(getDb(), actorOf(user), text(fd, "id"));
  } catch (e) {
    return toState(e);
  }
  refreshPublicSite();
  redirect(tagsUrl(fd, { done: "deleted" }));
}

export async function purgeUnusedTagsAction(
  _prev: TaxonomyActionState,
  fd: FormData,
): Promise<TaxonomyActionState> {
  const user = await requirePermission("taxonomy.manage");
  let removed = 0;
  try {
    removed = await deleteUnusedTags(getDb(), actorOf(user));
  } catch (e) {
    return toState(e);
  }
  refreshPublicSite();
  redirect(tagsUrl(fd, { done: "purged", n: String(removed) }));
}
