import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { listManagedPages } from "@/lib/admin/pages";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "الصفحات" };

export default async function AdminPagesPage() {
  await requirePermission("pages.edit");
  const pages = await listManagedPages(getDb());
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">الصفحات</h1>
      <p className="mb-8 text-muted-foreground">
        نصوص الصفحات الثابتة في الموقع. لا تظهر الصفحة للزوار إلا بعد أن تكتب نصها وتنشرها.
      </p>
      <div className="max-w-3xl overflow-hidden rounded-md border border-border">
        <table className="w-full text-start text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                الصفحة
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                الحالة
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold">
                آخر تعديل
              </th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => {
              const hasText = p.body.trim().length > 0;
              const status = p.published && hasText ? "منشورة" : hasText ? "غير منشورة" : "فارغة";
              const tone =
                status === "منشورة"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-border bg-muted text-muted-foreground";
              return (
                <tr key={p.key} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/pages/${p.key}`}
                      className="font-semibold text-accent underline underline-offset-4"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tone}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {hasText ? formatDate(p.updatedAt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
