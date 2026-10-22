"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { parseContentForm } from "@/lib/admin/content-input";
import { valuesFromFormData, type FormValues } from "@/lib/admin/content-form-values";
import {
  PermissionError,
  ValidationError,
  WorkflowError,
  createContent,
  deleteContent,
  playableSourceErrors,
  transition,
  updateContent,
  type Actor,
  type Transition,
} from "@/lib/admin/content";

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: FormValues;
  /** Changes on every failed submit so the form re-renders with the submitted values. */
  nonce?: string;
};
export type WorkflowActionState = { ok?: boolean; message?: string };

const TRANSITIONS: readonly Transition[] = [
  "submit",
  "approve",
  "request_changes",
  "publish",
  "unpublish",
  "archive",
  "restore",
];
const DONE: Record<Transition, string> = {
  submit: "أُرسلت المادة للمراجعة.",
  approve: "اعتُمدت المادة.",
  request_changes: "أُعيدت المادة للتعديل.",
  publish: "نُشرت المادة وهي الآن ظاهرة للزوار.",
  unpublish: "أُلغي نشر المادة.",
  archive: "أُرشفت المادة.",
  restore: "استُعيدت المادة من الأرشيف.",
};

const actorOf = (u: SessionUser): Actor => ({ id: u.id, permissions: u.permissions });

function failure(e: unknown, values: FormValues): FormState {
  const nonce = crypto.randomUUID();
  if (e instanceof ValidationError) return { errors: e.errors, values, nonce };
  if (e instanceof PermissionError || e instanceof WorkflowError) {
    return { message: e.message, values, nonce };
  }
  console.error("Content action failed:", e instanceof Error ? e.message : e);
  return { message: "تعذّر حفظ المادة الآن. حاول مرة أخرى.", values, nonce };
}

export async function createContentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("content.create");
  const values = valuesFromFormData(fd);
  const parsed = parseContentForm(fd);
  if (!parsed.ok) return { errors: parsed.errors, values, nonce: crypto.randomUUID() };
  let row;
  try {
    const bad = await playableSourceErrors(getDb(), undefined, parsed.data.sources);
    if (Object.keys(bad).length) return { errors: bad, values, nonce: crypto.randomUUID() };
    row = await createContent(getDb(), actorOf(user), parsed.data);
  } catch (e) {
    return failure(e, values);
  }
  updateTag("content");
  redirect(`/admin/content/${row.id}?saved=1`); // outside try/catch: redirect() throws
}

export async function updateContentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("content.edit");
  const id = String(fd.get("id") ?? "");
  const values = valuesFromFormData(fd);
  const parsed = parseContentForm(fd);
  if (!parsed.ok) return { errors: parsed.errors, values, nonce: crypto.randomUUID() };
  try {
    const bad = await playableSourceErrors(getDb(), id, parsed.data.sources);
    if (Object.keys(bad).length) return { errors: bad, values, nonce: crypto.randomUUID() };
    await updateContent(getDb(), actorOf(user), id, parsed.data);
  } catch (e) {
    return failure(e, values);
  }
  updateTag("content");
  revalidatePath("/admin/content");
  redirect(`/admin/content/${id}?saved=1`);
}

export async function transitionAction(
  _prev: WorkflowActionState,
  fd: FormData,
): Promise<WorkflowActionState> {
  const user = await requireUser();
  const id = String(fd.get("id") ?? "");
  const action = String(fd.get("action") ?? "") as Transition;
  if (!TRANSITIONS.includes(action)) return { ok: false, message: "إجراء غير معروف." };
  try {
    await transition(getDb(), actorOf(user), id, action);
  } catch (e) {
    if (e instanceof PermissionError || e instanceof WorkflowError) {
      return { ok: false, message: e.message };
    }
    console.error("Transition failed:", e instanceof Error ? e.message : e);
    return { ok: false, message: "تعذّر تنفيذ الإجراء الآن. حاول مرة أخرى." };
  }
  updateTag("content");
  revalidatePath(`/admin/content/${id}`);
  revalidatePath("/admin/content");
  return { ok: true, message: DONE[action] };
}

export async function deleteContentAction(
  _prev: WorkflowActionState,
  fd: FormData,
): Promise<WorkflowActionState> {
  const user = await requirePermission("content.delete");
  const id = String(fd.get("id") ?? "");
  let slug: string;
  try {
    ({ slug } = await deleteContent(getDb(), actorOf(user), id));
  } catch (e) {
    if (e instanceof PermissionError || e instanceof WorkflowError) {
      return { ok: false, message: e.message };
    }
    console.error("Delete failed:", e instanceof Error ? e.message : e);
    return { ok: false, message: "تعذّر حذف المادة الآن. حاول مرة أخرى." };
  }
  // The public site must stop serving the item (and its page) immediately.
  updateTag("content");
  revalidatePath("/admin/content");
  revalidatePath(`/library/${encodeURIComponent(slug)}`);
  redirect("/admin/content?deleted=1"); // outside try/catch: redirect() throws
}
