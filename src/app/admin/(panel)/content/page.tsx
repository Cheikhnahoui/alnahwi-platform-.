import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ADMIN_PAGE_SIZE,
  STATE_FILTERS,
  listAdminContent,
  listTypeOptions,
} from "@/lib/admin/content";
import { WORKFLOW_LABELS, hasPermission } from "@/lib/admin/workflow";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "المواد" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const dateFmt = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeZone: "UTC" });

export default async function ContentListPage({ searchParams }: Props) {
  const user = await requirePermission("content.view_drafts");
  const raw = await searchParams;
  const q = first(raw.q).trim().slice(0, 100);
  const state = (STATE_FILTERS as readonly string[]).includes(first(raw.state))
    ? first(raw.state)
    : "";
  const typeId = first(raw.type).slice(0, 40);
  const pageNum = Number.parseInt(first(raw.page), 10);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(pageNum, 10_000) : 1;

  const db = getDb();
  const [list, types] = await Promise.all([
    listAdminContent(db, { q, state, typeId, page }),
    listTypeOptions(db),
  ]);
  const last = Math.max(1, Math.ceil(list.total / ADMIN_PAGE_SIZE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (state) sp.set("state", state);
    if (typeId) sp.set("type", typeId);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/content${s ? `?${s}` : ""}`;
  };
  const control =
    "w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-accent";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">المواد العلمية</h1>
        {hasPermission(user, "content.create") && (
          <Link
            href="/admin/content/new"
            className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-foreground hover:opacity-90"
          >
            مادة جديدة
          </Link>
        )}
      </div>

      <form
        method="get"
        role="search"
        className="mt-6 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[1fr_12rem_12rem_auto]"
      >
        <div>
          <label htmlFor="c-q" className="mb-1 block text-sm font-semibold">
            بحث
          </label>
          <input id="c-q" name="q" defaultValue={q} maxLength={100} className={control} />
        </div>
        <div>
          <label htmlFor="c-state" className="mb-1 block text-sm font-semibold">
            الحالة
          </label>
          <select id="c-state" name="state" defaultValue={state} className={control}>
            <option value="">كل الحالات</option>
            {STATE_FILTERS.map((s) => (
              <option key={s} value={s}>
                {WORKFLOW_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="c-type" className="mb-1 block text-sm font-semibold">
            النوع
          </label>
          <select id="c-type" name="type" defaultValue={typeId} className={control}>
            <option value="">كل الأنواع</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-md border border-border px-4 py-2 hover:bg-muted"
          >
            تطبيق
          </button>
        </div>
      </form>

      <div className="mt-6">
        {list.total === 0 ? (
          <EmptyState
            title={q || state || typeId ? "لا توجد مواد مطابقة" : "لا توجد مواد بعد"}
            description={
              q || state || typeId ? "غيّر البحث أو الفلاتر." : "أنشئ أول مادة بالزر أعلاه."
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{list.total} مادة</p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[40rem] text-start text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">
                      العنوان
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">
                      النوع
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">
                      الحالة
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-semibold">
                      آخر تعديل
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/content/${i.id}`}
                          className="font-semibold text-accent underline underline-offset-4"
                        >
                          {i.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{i.typeName}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          approvalStatus={i.approvalStatus}
                          publicationStatus={i.publicationStatus}
                        />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {dateFmt.format(i.updatedAt)}
                        {i.updatedByName && <span> — {i.updatedByName}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {last > 1 && (
              <nav
                aria-label="ترقيم الصفحات"
                className="mt-6 flex items-center justify-center gap-3 text-sm"
              >
                {page > 1 && (
                  <Link
                    href={href(page - 1)}
                    rel="prev"
                    className="rounded-md border border-border px-4 py-2 hover:bg-muted"
                  >
                    السابق
                  </Link>
                )}
                <span>
                  صفحة {page} من {last}
                </span>
                {page < last && (
                  <Link
                    href={href(page + 1)}
                    rel="next"
                    className="rounded-md border border-border px-4 py-2 hover:bg-muted"
                  >
                    التالي
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
