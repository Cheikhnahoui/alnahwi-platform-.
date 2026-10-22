"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/admin/(panel)/content/actions";
import type { CategoryOption } from "@/lib/admin/content";
import type { FormValues } from "@/lib/admin/content-form-values";
import { MAX_SOURCES } from "@/lib/admin/content-constants";
import { PERMISSION_LABELS, SOURCE_KIND_LABELS } from "@/lib/format";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  id?: string;
  types: { id: string; name: string }[];
  categories: CategoryOption[];
  initial: FormValues;
  canFeature: boolean;
  disabled?: boolean;
  submitLabel: string;
};

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 outline-none focus:border-accent disabled:bg-muted";

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`e-${name}`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContentForm({
  action,
  id,
  types,
  categories,
  initial,
  canFeature,
  disabled,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const v = state.values ?? initial;
  const errors = state.errors ?? {};
  const val = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const chosen = new Set(Array.isArray(v.categoryIds) ? v.categoryIds : []);

  const filledSources = Array.from({ length: MAX_SOURCES }, (_, i) => i).filter((i) =>
    val(`sources.${i}.url`),
  );
  const sourceRows = Math.min(MAX_SOURCES, Math.max(3, (filledSources.at(-1) ?? -1) + 2));

  const aria = (name: string) => ({
    id: `f-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `e-${name}` : undefined,
  });

  return (
    <form action={formAction} key={state.nonce ?? "initial"} className="space-y-8">
      {id && <input type="hidden" name="id" value={id} />}
      {(state.message || Object.keys(errors).length > 0) && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.message ?? "راجع الحقول المظللة أدناه ثم أعد المحاولة."}
        </div>
      )}
      <fieldset disabled={disabled} className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-lg font-bold">البيانات الأساسية</h2>
          <Field name="title" error={errors.title} label="العنوان *">
            <input
              {...aria("title")}
              defaultValue={val("title")}
              maxLength={200}
              required
              className={input}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="contentTypeId" error={errors.contentTypeId} label="نوع المادة *">
              <select
                {...aria("contentTypeId")}
                defaultValue={val("contentTypeId")}
                required
                className={input}
              >
                <option value="">اختر…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              name="slug"
              error={errors.slug}
              label="الرابط (اختياري)"
              hint="يُولَّد من العنوان إن تُرك فارغًا. حروف وأرقام وشرطات فقط."
            >
              <input {...aria("slug")} defaultValue={val("slug")} dir="ltr" className={input} />
            </Field>
          </div>
          <Field
            name="summary"
            error={errors.summary}
            label="ملخص قصير"
            hint="حتى 500 حرف. يظهر في البطاقات."
          >
            <textarea
              {...aria("summary")}
              defaultValue={val("summary")}
              rows={3}
              maxLength={500}
              className={input}
            />
          </Field>
          <Field
            name="description"
            error={errors.description}
            label="الوصف"
            hint="نص عادي. افصل الفقرات بسطر فارغ."
          >
            <textarea
              {...aria("description")}
              defaultValue={val("description")}
              rows={8}
              className={input}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">التفاصيل</h2>
          <Field
            name="speakerName"
            error={errors.speakerName}
            label="اسم المتحدث"
            hint="اكتب ما هو موثّق فقط. اتركه فارغًا إن لم يكن معلومًا."
          >
            <input {...aria("speakerName")} defaultValue={val("speakerName")} className={input} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="recordedAt"
              error={errors.recordedAt}
              label="تاريخ الإلقاء"
              hint="اتركه فارغًا إن كان غير معروف."
            >
              <input
                {...aria("recordedAt")}
                type="date"
                defaultValue={val("recordedAt")}
                dir="ltr"
                className={input}
              />
            </Field>
            <Field
              name="duration"
              error={errors.duration}
              label="المدة"
              hint="مثال: 1:25:30 أو 45:10 أو 90 (دقيقة)."
            >
              <input
                {...aria("duration")}
                defaultValue={val("duration")}
                dir="ltr"
                className={input}
              />
            </Field>
          </div>
          <Field
            name="thumbnailUrl"
            error={errors.thumbnailUrl}
            label="رابط الصورة المصغّرة"
            hint="رابط https:// لصورة مأذون باستخدامها."
          >
            <input
              {...aria("thumbnailUrl")}
              defaultValue={val("thumbnailUrl")}
              dir="ltr"
              className={input}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">التصنيف والوسوم</h2>
          <div>
            <p className="mb-2 text-sm font-semibold">التصنيفات</p>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                لا توجد تصنيفات بعد. تُضاف من قسم التصنيفات لاحقًا.
              </p>
            ) : (
              <ul className="space-y-1 rounded-md border border-border p-3">
                {categories.map((c) => (
                  <li key={c.id} className={c.depth ? "ps-6" : ""}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="categoryIds"
                        value={c.id}
                        defaultChecked={chosen.has(c.id)}
                      />
                      <span>
                        {c.name}
                        {!c.isActive && (
                          <span className="text-xs text-muted-foreground"> (مخفي)</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {errors.categoryIds && (
              <p className="mt-1 text-sm text-red-700">{errors.categoryIds}</p>
            )}
          </div>
          <Field
            name="tags"
            error={errors.tags}
            label="الوسوم"
            hint="افصل بينها بفاصلة أو سطر جديد."
          >
            <textarea {...aria("tags")} defaultValue={val("tags")} rows={2} className={input} />
          </Field>
          <Field
            name="related"
            error={errors.related}
            label="مواد ذات صلة"
            hint="روابط المواد (slug) مفصولة بفاصلة أو مسافة."
          >
            <input {...aria("related")} defaultValue={val("related")} dir="ltr" className={input} />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">المصادر</h2>
          <p className="text-sm text-muted-foreground">
            روابط خارجية فقط. لا يُرفع أي محتوى من مواقع أخرى دون التحقق من الإذن وشروط المنصة.
          </p>
          <p className="text-sm text-muted-foreground">
            للفيديو والصوت: اختر نوع المصدر «فيديو» أو «صوت» وألصق رابط YouTube أو Vimeo، أو رابطًا
            مباشرًا لملف (mp4 / webm للفيديو، mp3 / m4a / ogg للصوت) يبدأ بـ https://. سيُشغَّل داخل
            صفحة المادة، ويبقى رابط المصدر ظاهرًا في قسم «المصادر».
          </p>
          <ul className="space-y-3">
            {Array.from({ length: sourceRows }, (_, i) => (
              <li
                key={i}
                className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[8rem_1fr_10rem]"
              >
                <select
                  name={`sources.${i}.kind`}
                  defaultValue={val(`sources.${i}.kind`) || "external_link"}
                  aria-label={`نوع المصدر ${i + 1}`}
                  className={input}
                >
                  {Object.entries(SOURCE_KIND_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <div>
                  <input
                    name={`sources.${i}.url`}
                    defaultValue={val(`sources.${i}.url`)}
                    placeholder="https://…"
                    dir="ltr"
                    aria-label={`رابط المصدر ${i + 1}`}
                    className={input}
                  />
                  {errors[`sources.${i}.url`] && (
                    <p className="mt-1 text-sm text-red-700">{errors[`sources.${i}.url`]}</p>
                  )}
                </div>
                <input
                  name={`sources.${i}.sourceName`}
                  defaultValue={val(`sources.${i}.sourceName`)}
                  placeholder="اسم المصدر"
                  aria-label={`اسم المصدر ${i + 1}`}
                  className={input}
                />
                <div className="flex flex-wrap gap-4 text-sm sm:col-span-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="primarySource"
                      value={String(i)}
                      defaultChecked={(val("primarySource") || "0") === String(i)}
                    />
                    المصدر الرئيسي
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name={`sources.${i}.isDownloadable`}
                      defaultChecked={val(`sources.${i}.isDownloadable`) === "on"}
                    />
                    قابل للتحميل (يُعرض التحميل فقط إن كان الإذن «مأذون بها» أو «مباحة»)
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">الحقوق والإذن</h2>
          <Field
            name="permissionStatus"
            error={errors.permissionStatus}
            label="حالة الإذن بإعادة النشر"
          >
            <select
              {...aria("permissionStatus")}
              defaultValue={val("permissionStatus") || "unknown"}
              className={input}
            >
              {Object.entries(PERMISSION_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field name="copyrightNotice" error={errors.copyrightNotice} label="إشعار حقوق النشر">
            <textarea
              {...aria("copyrightNotice")}
              defaultValue={val("copyrightNotice")}
              rows={2}
              className={input}
            />
          </Field>
          <Field
            name="reuseRestrictions"
            error={errors.reuseRestrictions}
            label="قيود إعادة الاستخدام"
          >
            <textarea
              {...aria("reuseRestrictions")}
              defaultValue={val("reuseRestrictions")}
              rows={2}
              className={input}
            />
          </Field>
          {canFeature && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={val("isFeatured") === "on"}
              />
              عرض ضمن «مواد مختارة» في الصفحة الرئيسية
            </label>
          )}
        </section>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-6 py-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ…" : submitLabel}
        </button>
      </fieldset>
    </form>
  );
}
