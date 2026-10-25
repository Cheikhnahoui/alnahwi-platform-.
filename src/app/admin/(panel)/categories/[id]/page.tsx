import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/CategoryForm";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { getAdminCategory, listAdminCategories } from "@/lib/admin/taxonomy";

export const metadata: Metadata = { title: "تعديل تصنيف" };

const DONE: Record<string, string> = {
  saved: "تم حفظ التصنيف.",
  saved_slug: "تم حفظ التصنيف. تغيّر رابطه، فتعمل الصفحة الآن على الرابط الجديد فقط.",
};

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  await requirePermission("taxonomy.manage");
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const db = getDb();
  const cat = await getAdminCategory(db, id);
  if (!cat) notFound();
  const parents = (await listAdminCategories(db))
    .filter((c) => c.depth === 0 && c.id !== cat.id)
    .map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <Link href="/admin/categories" className="text-sm text-accent underline underline-offset-4">
        ← التصنيفات
      </Link>
      <div className="mt-3 mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{cat.name}</h1>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            cat.isActive
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {cat.isActive ? "ظاهر" : "مخفي"}
        </span>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        مرتبط بـ {cat.materials} مادة
        {cat.children > 0 && ` · فيه ${cat.children} تصنيفًا فرعيًا`}
        {cat.isActive && (
          <>
            {" · "}
            <Link
              href={`/categories/${encodeURIComponent(cat.slug)}`}
              className="text-accent underline underline-offset-4"
            >
              عرض الصفحة العامة
            </Link>
          </>
        )}
      </p>
      {done && DONE[done] && (
        <p
          role="status"
          className="mb-6 max-w-2xl rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {DONE[done]}
        </p>
      )}
      <div className="max-w-2xl">
        <CategoryForm
          initial={{
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description ?? "",
            imageUrl: cat.imageUrl ?? "",
            parentId: cat.parentId ?? "",
            isActive: cat.isActive,
          }}
          parents={parents}
          hasChildren={cat.children > 0}
          submitLabel="حفظ التعديلات"
        />
      </div>
    </>
  );
}
