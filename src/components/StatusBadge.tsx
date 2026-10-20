import { WORKFLOW_LABELS, workflowState } from "@/lib/admin/workflow";

const STYLE: Record<string, string> = {
  draft: "border-border bg-muted text-foreground",
  in_review: "border-amber-300 bg-amber-50 text-amber-900",
  approved: "border-sky-300 bg-sky-50 text-sky-900",
  published: "border-emerald-300 bg-emerald-50 text-emerald-900",
  archived: "border-border bg-background text-muted-foreground",
};

export function StatusBadge({
  approvalStatus,
  publicationStatus,
}: {
  approvalStatus: string;
  publicationStatus: string;
}) {
  const st = workflowState({ approvalStatus, publicationStatus });
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLE[st]}`}
    >
      {WORKFLOW_LABELS[st]}
    </span>
  );
}
