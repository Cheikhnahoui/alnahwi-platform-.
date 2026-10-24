"use client";

import { useActionState } from "react";
import { savePageAction, type PageFormState } from "@/app/admin/(panel)/pages/actions";
import { PAGE_BODY_MAX, PAGE_TITLE_MAX } from "@/lib/admin/pages";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-accent";

export function PageForm({
  pageKey,
  initial,
  published,
}: {
  pageKey: string;
  initial: { title: string; body: string };
  published: boolean;
}) {
  const [state, action, pending] = useActionState<PageFormState, FormData>(savePageAction, {});
  const errors = state.errors ?? {};
  const values = state.values ?? initial;
  const primary =
    "rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60";
  const secondary =
    "rounded-md border border-border px-6 py-3 font-semibold hover:bg-muted disabled:opacity-60";

  return (
    <form action={action} key={state.nonce ?? "initial"} className="space-y-6">
      <input type="hidden" name="key" value={pageKey} />
      {(state.message || Object.keys(errors).length > 0) && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.message ?? "راجع الحقول المظللة أدناه ثم أعد المحاولة."}
        </div>
      )}

      <div>
        <label htmlFor="page-title" className="mb-1 block text-sm font-semibold">
          عنوان الصفحة *
        </label>
        <input
          id="page-title"
          name="title"
          defaultValue={values.title}
          maxLength={PAGE_TITLE_MAX}
          required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "page-title-error" : undefined}
          className={input}
        />
        {errors.title && (
          <p id="page-title-error" className="mt-1 text-sm text-red-700">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="page-body" className="mb-1 block text-sm font-semibold">
          النص
        </label>
        <textarea
          id="page-body"
          name="body"
          rows={18}
          defaultValue={values.body}
          maxLength={PAGE_BODY_MAX}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? "page-body-error" : "page-body-hint"}
          className={`${input} leading-8`}
        />
        {errors.body ? (
          <p id="page-body-error" className="mt-1 text-sm text-red-700">
            {errors.body}
          </p>
        ) : (
          <p id="page-body-hint" className="mt-1 text-xs text-muted-foreground">
            نص عادي: اترك سطرًا فارغًا بين كل فقرتين. لا تُعرض العناوين الفرعية ولا الخط العريض ولا
            الروابط داخل النص. الحد الأقصى {PAGE_BODY_MAX.toLocaleString("en")} حرف.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {published ? (
          <>
            <button type="submit" name="intent" value="save" disabled={pending} className={primary}>
              {pending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
            </button>
            <button
              type="submit"
              name="intent"
              value="unpublish"
              disabled={pending}
              className={secondary}
            >
              إلغاء النشر
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              name="intent"
              value="save"
              disabled={pending}
              className={secondary}
            >
              {pending ? "جارٍ الحفظ…" : "حفظ كمسودة"}
            </button>
            <button
              type="submit"
              name="intent"
              value="publish"
              disabled={pending}
              className={primary}
            >
              حفظ ونشر
            </button>
          </>
        )}
      </div>
    </form>
  );
}
