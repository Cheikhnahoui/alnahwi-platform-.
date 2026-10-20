"use client";

import { useActionState } from "react";
import { transitionAction, type WorkflowActionState } from "@/app/admin/(panel)/content/actions";
import { TRANSITION_LABELS, type Transition } from "@/lib/admin/workflow";

const PRIMARY: Transition[] = ["publish", "approve", "submit"];

export function WorkflowPanel({ id, transitions }: { id: string; transitions: Transition[] }) {
  const [state, action, pending] = useActionState<WorkflowActionState, FormData>(
    transitionAction,
    {},
  );
  if (transitions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        لا توجد إجراءات متاحة لك على هذه المادة في حالتها الحالية.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-md border px-3 py-2 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button
            key={t}
            type="submit"
            name="action"
            value={t}
            disabled={pending}
            className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
              PRIMARY.includes(t)
                ? "bg-accent text-accent-foreground hover:opacity-90"
                : "border border-border hover:bg-muted"
            }`}
          >
            {TRANSITION_LABELS[t]}
          </button>
        ))}
      </div>
    </form>
  );
}
