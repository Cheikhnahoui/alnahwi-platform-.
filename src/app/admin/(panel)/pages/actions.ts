"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { PermissionError, ValidationError, WorkflowError } from "@/lib/admin/content";
import { pagePath, parsePageForm, savePage } from "@/lib/admin/pages";

export type PageFormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: { title: string; body: string };
  /** Changes on every failed submit so the form re-renders with what was typed. */
  nonce?: string;
};

export async function savePageAction(_prev: PageFormState, fd: FormData): Promise<PageFormState> {
  const user = await requirePermission("pages.edit");
  const key = String(fd.get("key") ?? "");
  const values = { title: String(fd.get("title") ?? ""), body: String(fd.get("body") ?? "") };
  const fail = (extra: Partial<PageFormState>): PageFormState => ({
    values,
    nonce: crypto.randomUUID(),
    ...extra,
  });

  const parsed = parsePageForm(fd);
  if (!parsed.ok) return fail({ errors: parsed.errors });

  try {
    await savePage(getDb(), { id: user.id, permissions: user.permissions }, key, parsed.data);
  } catch (e) {
    if (e instanceof ValidationError) return fail({ errors: e.errors });
    if (e instanceof PermissionError || e instanceof WorkflowError) {
      return fail({ message: e.message });
    }
    console.error("Page save failed:", e instanceof Error ? e.message : e);
    return fail({ message: "تعذّر حفظ الصفحة الآن. حاول مرة أخرى." });
  }

  // The public page, the footer links and the home-page excerpt must show the change at once.
  updateTag("pages");
  updateTag("content");
  const path = pagePath(key);
  if (path) revalidatePath(path);
  revalidatePath("/");
  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${key}?done=${parsed.data.intent}`); // outside try/catch: redirect() throws
}
