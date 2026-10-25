"use client";

import { useActionState, useRef } from "react";
import type { TaxonomyActionState } from "@/app/admin/(panel)/taxonomy/actions";

/**
 * A button that asks for confirmation in a dialog (native <dialog>: focus-trapped, Esc closes) and then
 * runs a server action with the given hidden fields. Errors from the action are shown in the dialog.
 */
export function ConfirmActionButton({
  action,
  fields,
  label,
  title,
  description,
  confirmLabel,
  pendingLabel = "جارٍ التنفيذ…",
  tone = "danger",
}: {
  action: (prev: TaxonomyActionState, fd: FormData) => Promise<TaxonomyActionState>;
  fields: Record<string, string>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: "danger" | "neutral";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<TaxonomyActionState, FormData>(action, {});
  const id = `confirm-${Object.values(fields).join("-").slice(0, 40)}-${label.length}`;
  const danger = tone === "danger";
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
          danger ? "border-red-300 text-red-800 hover:bg-red-50" : "border-border hover:bg-muted"
        }`}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-6 text-foreground backdrop:bg-black/40"
      >
        <form action={formAction} className="space-y-4">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <h2 id={`${id}-title`} className="text-lg font-bold">
            {title}
          </h2>
          <p className="text-sm">{description}</p>
          {state.message && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              disabled={pending}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                danger ? "bg-red-700 hover:bg-red-800" : "bg-accent hover:opacity-90"
              }`}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
