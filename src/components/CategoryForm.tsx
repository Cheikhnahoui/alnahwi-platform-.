"use client";

import { useActionState } from "react";
import {
  createCategoryAction,
  updateCategoryAction,
  type TaxonomyActionState,
} from "@/app/admin/(panel)/taxonomy/actions";
import { DESCRIPTION_MAX, NAME_MAX } from "@/lib/admin/taxonomy";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-accent";

type Initial = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentId: string;
  isActive: boolean;
};

export const EMPTY_CATEGORY: Initial = {
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  parentId: "",
  isActive: true,
};

/** Create (no id) or edit (with id) one category. */
export function CategoryForm({
  initial,
  parents,
  hasChildren = false,
  submitLabel,
}: {
  initial: Initial;
  /** Main categories that may be chosen as the parent (never the category itself). */
  parents: { id: string; name: string }[];
  hasChildren?: boolean;
  submitLabel: string;
}) {
  const editing = Boolean(initial.id);
  const [state, action, pending] = useActionState<TaxonomyActionState, FormData>(
    editing ? updateCategoryAction : createCategoryAction,
    {},
  );
  const errors = state.errors ?? {};
  const v = state.values
    ? { ...initial, ...state.values, isActive: state.values.isActive === "on" }
    : initial;
  const field = (name: string, label: string, hint?: string) => (
    <div>
      <label htmlFor={`cat-${name}`} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={`cat-${name}`}
        name={name}
        defaultValue={String(v[name as keyof Initial] ?? "")}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `cat-${name}-err` : hint ? `cat-${name}-hint` : undefined}
        className={input}
        {...(name === "name" ? { required: true, maxLength: NAME_MAX } : {})}
        {...(name === "slug"
          ? { dir: "ltr", placeholder: "يُولَّد من الاسم إن تركته فارغًا" }
          : {})}
        {...(name === "imageUrl" ? { dir: "ltr", placeholder: "https://…" } : {})}
      />
      {errors[name] ? (
        <p id={`cat-${name}-err`} className="mt-1 text-sm text-red-700">
          {errors[name]}
        </p>
      ) : (
        hint && (
          <p id={`cat-${name}-hint`} className="mt-1 text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );

  return (
    <form action={action} key={state.nonce ?? "initial"} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {state.message && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "اسم التصنيف *")}
        {field(
          "slug",
          "الرابط (slug)",
          editing
            ? "تنبيه: تغيير الرابط يغيّر عنوان صفحة التصنيف، فتتعطل الروابط القديمة المحفوظة عند الناس."
            : "اختياري. حروف وأرقام مفصولة بشرطة.",
        )}
      </div>

      <div>
        <label htmlFor="cat-parentId" className="mb-1 block text-sm font-semibold">
          التصنيف الأب
        </label>
        {hasChildren ? (
          <>
            <input type="hidden" name="parentId" value="" />
            <p className="rounded-md border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              تصنيف رئيسي، وله تصنيفات فرعية، فلا يمكن جعله فرعيًا.
            </p>
          </>
        ) : (
          <select
            id="cat-parentId"
            name="parentId"
            defaultValue={v.parentId}
            aria-invalid={errors.parentId ? true : undefined}
            className={input}
          >
            <option value="">بلا أب (تصنيف رئيسي)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {errors.parentId && <p className="mt-1 text-sm text-red-700">{errors.parentId}</p>}
      </div>

      <div>
        <label htmlFor="cat-description" className="mb-1 block text-sm font-semibold">
          الوصف
        </label>
        <textarea
          id="cat-description"
          name="description"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          defaultValue={v.description}
          aria-invalid={errors.description ? true : undefined}
          className={input}
        />
        {errors.description && <p className="mt-1 text-sm text-red-700">{errors.description}</p>}
      </div>

      {field("imageUrl", "رابط صورة (اختياري)")}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={v.isActive} className="h-4 w-4" />
        ظاهر للزوار
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "جارٍ الحفظ…" : submitLabel}
      </button>
    </form>
  );
}
