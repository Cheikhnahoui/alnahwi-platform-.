"use client";

import { useActionState, useRef } from "react";
import { deleteContentAction, type WorkflowActionState } from "@/app/admin/(panel)/content/actions";

/** Permanent deletion behind a confirmation dialog (native <dialog>: focus-trapped, Esc closes). */
export function DeleteContentButton({ id, title }: { id: string; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<WorkflowActionState, FormData>(
    deleteContentAction,
    {},
  );
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
      >
        حذف المادة نهائيًا
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`del-title-${id}`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-6 text-foreground backdrop:bg-black/40"
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <h2 id={`del-title-${id}`} className="text-lg font-bold">
            حذف المادة نهائيًا؟
          </h2>
          <p className="text-sm">
            ستُحذف المادة «{title}» من الموقع ومن قاعدة البيانات، مع مصادرها وتصنيفاتها ووسومها
            وروابط المواد ذات الصلة. <strong>لا يمكن التراجع عن هذا الإجراء.</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            إن أردت إخفاءها فقط مع الاحتفاظ بها، فاستخدم «إلغاء النشر» أو «أرشفة» بدل الحذف.
          </p>
          {state.message && !state.ok && (
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
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "جارٍ الحذف…" : "نعم، احذف نهائيًا"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
