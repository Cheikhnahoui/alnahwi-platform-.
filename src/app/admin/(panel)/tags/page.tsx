import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { TAGS_PAGE_SIZE, listAdminTags } from "@/lib/admin/taxonomy";
import { deleteTagAction, purgeUnusedTagsAction, renameTagAction } from "../taxonomy/actions";

export const metadata: Metadata = { title: "الوسوم" };

type Search = { q?: string; page?: string; done?: string; e?: string; n?: string };

const ERRORS: Record<string, string> = {
  name_error: "تعذّرت إعادة التسمية: الاسم فارغ أو أطول من 60 حرفًا أو مستخدم لوسم آخر.",
  missing: "الوسم غير موجود أو حُذف من قبل.",
  failed: "تعذّر تنفيذ العملية الآن. حاول مرة أخرى.",
};

export default async function AdminTagsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("taxonomy.manage");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = /^[1-9]\d{0,3}$/.test(sp.page ?? "") ? Number(sp.page) : 1;
  const { items, total, unused } = await listAdminTags(getDb(), { q, page });
  const pages = Math.max(1, Math.ceil(total / TAGS_PAGE_SIZE));
  const link = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/tags${s ? `?${s}` : ""}`;
  };
  const notice =
    sp.done === "renamed"
      ? "تمت إعادة تسمية الوسم."
      : sp.done === "deleted"
        ? "حُذف الوسم."
        : sp.done === "purged"
          ? `حُذف ${/^\d{1,6}$/.test(sp.n ?? "") ? sp.n : 0} وسمًا غير مستخدم.`
          : null;

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">الوسوم</h1>
      <p className="mb-6 max-w-3xl text-muted-foreground">
        تُنشأ الوسوم أثناء تعديل المواد. من هنا تعيد تسمية وسم (فيتحدث في كل موادّه)، أو تحذف ما لم
        يعد مستخدمًا. لا يُحذف وسم مستخدم في أي مادة.
      </p>

      {notice && (
        <p
          role="status"
          className="mb-4 max-w-4xl rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}
      {sp.e && ERRORS[sp.e] && (
        <p
          role="alert"
          className="mb-4 max-w-4xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {ERRORS[sp.e]}
        </p>
      )}

      <div className="mb-4 flex max-w-4xl flex-wrap items-end justify-between gap-3">
        <form action="/admin/tags" method="get" role="search" className="flex items-end gap-2">
          <div>
            <label htmlFor="tag-q" className="mb-1 block text-sm font-semibold">
              بحث في الوسوم
            </label>
            <input
              id="tag-q"
              name="q"
              defaultValue={q}
              maxLength={100}
              className="w-56 rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 font-semibold hover:bg-muted"
          >
            بحث
          </button>
        </form>
        {unused > 0 && (
          <ConfirmActionButton
            action={purgeUnusedTagsAction}
            fields={{ q, page: String(page) }}
            label={`حذف كل الوسوم غير المستخدمة (${unused})`}
            title="حذف الوسوم غير المستخدمة؟"
            description={`سيُحذف ${unused} وسمًا لا تستخدمه أي مادة. الوسوم المستخدمة لا تتأثر. لا يمكن التراجع.`}
            confirmLabel="نعم، احذفها"
          />
        )}
      </div>

      <p className="mb-2 text-sm text-muted-foreground">{total} وسمًا</p>
      {items.length === 0 ? (
        <p className="max-w-4xl rounded-md border border-border bg-muted px-4 py-6 text-muted-foreground">
          {q ? "لا توجد وسوم تطابق بحثك." : "لا توجد وسوم بعد. تُنشأ عند إضافتها في نموذج مادة."}
        </p>
      ) : (
        <div className="max-w-4xl overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {["الوسم", "المواد", "إجراءات"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-border align-middle">
                  <td className="px-4 py-3">
                    <form action={renameTagAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="q" value={q} />
                      <input type="hidden" name="page" value={String(page)} />
                      <label htmlFor={`tag-${t.id}`} className="sr-only">
                        اسم الوسم
                      </label>
                      <input
                        id={`tag-${t.id}`}
                        name="name"
                        defaultValue={t.name}
                        maxLength={60}
                        required
                        className="w-52 rounded-md border border-border bg-background px-3 py-1.5 outline-none focus:border-accent"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-muted"
                      >
                        حفظ الاسم
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">{t.uses}</td>
                  <td className="px-4 py-3">
                    {t.uses === 0 ? (
                      <ConfirmActionButton
                        action={deleteTagAction}
                        fields={{ id: t.id, q, page: String(page) }}
                        label="حذف"
                        title="حذف الوسم؟"
                        description={`سيُحذف الوسم «${t.name}». لا يمكن التراجع.`}
                        confirmLabel="نعم، احذف"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">مستخدم في {t.uses} مادة</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="صفحات الوسوم" className="mt-4 flex items-center gap-4 text-sm">
          {page > 1 && (
            <Link href={link(page - 1)} className="text-accent underline underline-offset-4">
              السابق
            </Link>
          )}
          <span className="text-muted-foreground">
            صفحة {page} من {pages}
          </span>
          {page < pages && (
            <Link href={link(page + 1)} className="text-accent underline underline-offset-4">
              التالي
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
