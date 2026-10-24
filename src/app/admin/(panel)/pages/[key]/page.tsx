import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageForm } from "@/components/PageForm";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { LEGAL_PAGE_KEYS, getManagedPage, pagePath } from "@/lib/admin/pages";
import { formatDate, toParagraphs } from "@/lib/format";

export const metadata: Metadata = { title: "تعديل صفحة" };

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ done?: string }> };

const DONE: Record<string, string> = {
  save: "تم حفظ الصفحة.",
  publish: "نُشرت الصفحة وهي الآن ظاهرة للزوار.",
  unpublish: "أُلغي نشر الصفحة، ونصها محفوظ.",
};

export default async function EditPagePage({ params, searchParams }: Props) {
  await requirePermission("pages.edit");
  const [{ key }, { done }] = await Promise.all([params, searchParams]);
  const page = await getManagedPage(getDb(), key);
  if (!page) notFound();
  const live = page.published && page.body.trim().length > 0;
  const path = pagePath(key);
  const paragraphs = toParagraphs(page.body);
  return (
    <>
      <Link href="/admin/pages" className="text-sm text-accent underline underline-offset-4">
        ← الصفحات
      </Link>
      <div className="mt-3 mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            live
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {live ? "منشورة" : "غير منشورة"}
        </span>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        آخر تعديل: {formatDate(page.updatedAt)}
        {live && path && (
          <>
            {" · "}
            <Link href={path} className="text-accent underline underline-offset-4">
              عرض الصفحة المنشورة
            </Link>
          </>
        )}
      </p>

      {done && DONE[done] && (
        <p
          role="status"
          className="mb-6 max-w-3xl rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {DONE[done]}
        </p>
      )}
      {LEGAL_PAGE_KEYS.includes(key) && (
        <p className="mb-6 max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          هذه صفحة سياسات: اجعل نصها مسودة وراجعه مراجعة قانونية قبل نشره. نشر نص لا يعني أنه يضمن
          الامتثال القانوني الكامل.
        </p>
      )}
      {key === "about" && (
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          اكتب هنا نصًا موثقًا فقط (لا تواريخ ولا مؤهلات ولا مناصب ولا أقوال غير مؤكدة). عند نشره
          يظهر مقتطف من بدايته أيضًا في الصفحة الرئيسية.
        </p>
      )}

      <div className="max-w-3xl">
        <PageForm
          pageKey={page.key}
          initial={{ title: page.title, body: page.body }}
          published={page.published}
        />
      </div>

      {paragraphs.length > 0 && (
        <section
          className="mt-12 max-w-3xl border-t border-border pt-6"
          aria-labelledby="h-preview"
        >
          <h2 id="h-preview" className="mb-1 text-lg font-bold">
            معاينة النص المحفوظ
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">كما سيظهر للزوار عند نشره.</p>
          <div className="max-w-[68ch] space-y-4 text-[1.0625rem]">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
