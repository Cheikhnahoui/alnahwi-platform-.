import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CategoryForm, EMPTY_CATEGORY } from "@/components/CategoryForm";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { listAdminCategories } from "@/lib/admin/taxonomy";
import {
  deleteCategoryAction,
  moveCategoryAction,
  toggleCategoryAction,
} from "../taxonomy/actions";

export const metadata: Metadata = { title: "التصنيفات" };

const DONE: Record<string, string> = {
  created: "أُضيف التصنيف.",
  deleted: "حُذف التصنيف.",
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  await requirePermission("taxonomy.manage");
  const { done } = await searchParams;
  const cats = await listAdminCategories(getDb());
  const parents = cats.filter((c) => c.depth === 0).map((c) => ({ id: c.id, name: c.name }));
  // first / last place among siblings decides which arrows are active
  const firstOf = new Set<string>();
  const lastOf = new Set<string>();
  const groups = new Map<string, string[]>();
  for (const c of cats) {
    const k = c.parentId ?? "top";
    groups.set(k, [...(groups.get(k) ?? []), c.id]);
  }
  for (const ids of groups.values()) {
    firstOf.add(ids[0]);
    lastOf.add(ids[ids.length - 1]);
  }

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">التصنيفات</h1>
      <p className="mb-6 text-muted-foreground">
        تنظيم المواد في تصنيفات رئيسية وفرعية (مستويان). التصنيف المخفي لا يظهر للزوار.
      </p>

      {done && DONE[done] && (
        <p
          role="status"
          className="mb-6 max-w-4xl rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {DONE[done]}
        </p>
      )}

      <details className="mb-8 max-w-4xl rounded-md border border-border p-4">
        <summary className="cursor-pointer font-semibold">إضافة تصنيف</summary>
        <div className="mt-4">
          <CategoryForm initial={EMPTY_CATEGORY} parents={parents} submitLabel="إضافة التصنيف" />
        </div>
      </details>

      {cats.length === 0 ? (
        <p className="max-w-4xl rounded-md border border-border bg-muted px-4 py-6 text-muted-foreground">
          لا توجد تصنيفات بعد. أضف أول تصنيف من الصندوق أعلاه.
        </p>
      ) : (
        <div className="max-w-4xl overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {["التصنيف", "الرابط", "المواد", "الحالة", "إجراءات"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-start font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-t border-border align-middle">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/categories/${c.id}`}
                      className={`font-semibold text-accent underline underline-offset-4 ${
                        c.depth === 1 ? "ms-6" : ""
                      }`}
                    >
                      {c.depth === 1 && <span aria-hidden>↳ </span>}
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                    {c.slug}
                  </td>
                  <td className="px-4 py-3">{c.materials}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${
                        c.isActive
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.isActive ? "ظاهر" : "مخفي"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {(["up", "down"] as const).map((dir) => {
                        const disabled = dir === "up" ? firstOf.has(c.id) : lastOf.has(c.id);
                        const Icon = dir === "up" ? ArrowUp : ArrowDown;
                        return (
                          <form key={dir} action={moveCategoryAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="direction" value={dir} />
                            <button
                              type="submit"
                              disabled={disabled}
                              aria-label={`${dir === "up" ? "تحريك لأعلى" : "تحريك لأسفل"}: ${c.name}`}
                              className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-30"
                            >
                              <Icon aria-hidden size={14} />
                            </button>
                          </form>
                        );
                      })}
                      <form action={toggleCategoryAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={c.isActive ? "0" : "1"} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                        >
                          {c.isActive ? "إخفاء" : "إظهار"}
                        </button>
                      </form>
                      <ConfirmActionButton
                        action={deleteCategoryAction}
                        fields={{ id: c.id }}
                        label="حذف"
                        title="حذف التصنيف؟"
                        description={`سيُحذف التصنيف «${c.name}» نهائيًا. لا يُحذف إلا إذا لم يكن مرتبطًا بمواد ولا فيه تصنيفات فرعية، وإلا ستظهر لك رسالة بالسبب. لا يمكن التراجع.`}
                        confirmLabel="نعم، احذف"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
