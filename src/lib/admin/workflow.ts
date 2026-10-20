/**
 * Pure workflow rules (no database, no Node APIs), so browser components can import them.
 */
import type { PermissionKey } from "@/lib/auth/permissions";

export type Actor = { id: string; permissions: readonly PermissionKey[] };

export const hasPermission = (a: Pick<Actor, "permissions">, p: PermissionKey) =>
  a.permissions.includes(p);

export type WorkflowState = "draft" | "in_review" | "approved" | "published" | "archived";
export const WORKFLOW_LABELS: Record<WorkflowState, string> = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمدة (غير منشورة)",
  published: "منشورة",
  archived: "مؤرشفة",
};

export function workflowState(i: {
  approvalStatus: string;
  publicationStatus: string;
}): WorkflowState {
  if (i.publicationStatus === "archived") return "archived";
  if (i.publicationStatus === "published") return "published";
  return i.approvalStatus === "approved" ? "approved" : (i.approvalStatus as WorkflowState);
}

export type Transition =
  "submit" | "approve" | "request_changes" | "publish" | "unpublish" | "archive" | "restore";

export const TRANSITION_LABELS: Record<Transition, string> = {
  submit: "إرسال للمراجعة",
  approve: "اعتماد",
  request_changes: "إعادة للتعديل",
  publish: "نشر",
  unpublish: "إلغاء النشر",
  archive: "أرشفة",
  restore: "استعادة من الأرشيف",
};

/** Which buttons to show. The transition itself is enforced again in transition(). */
export function availableTransitions(
  item: { approvalStatus: string; publicationStatus: string },
  actor: Pick<Actor, "permissions">,
  requireReview: boolean,
): Transition[] {
  const st = workflowState(item);
  const out: Transition[] = [];
  if (st === "draft" && hasPermission(actor, "content.edit")) out.push("submit");
  if (st === "in_review" && hasPermission(actor, "content.review"))
    out.push("approve", "request_changes");
  if (hasPermission(actor, "content.publish")) {
    if (st === "approved" || (!requireReview && (st === "draft" || st === "in_review"))) {
      out.push("publish");
    }
    if (st === "published") out.push("unpublish");
  }
  if (hasPermission(actor, "content.archive")) out.push(st === "archived" ? "restore" : "archive");
  return out;
}
