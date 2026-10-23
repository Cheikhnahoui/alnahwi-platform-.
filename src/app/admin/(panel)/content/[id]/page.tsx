import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentForm } from "@/components/ContentForm";
import { uploadsConfigured } from "@/lib/storage/store";
import { DeleteContentButton } from "@/components/DeleteContentButton";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import {
  availableTransitions,
  getAdminContent,
  getRequireReview,
  listCategoryOptions,
  listTypeOptions,
} from "@/lib/admin/content";
import { toFormValues } from "@/lib/admin/content-form-values";
import { hasPermission, workflowState } from "@/lib/admin/workflow";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { updateContentAction } from "../actions";

export const metadata: Metadata = { title: "تعديل مادة" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };
const dateFmt = new Intl.DateTimeFormat("ar-u-nu-latn", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function EditContentPage({ params, searchParams }: Props) {
  const user = await requirePermission("content.view_drafts");
  const { id } = await params;
  const { saved } = await searchParams;
  const db = getDb();
  const full = await getAdminContent(db, id);
  if (!full) notFound();
  const [types, categories, requireReview] = await Promise.all([
    listTypeOptions(db),
    listCategoryOptions(db),
    getRequireReview(db),
  ]);
  const { item } = full;
  const st = workflowState(item);

  let lockedReason: string | null = null;
  if (!hasPermission(user, "content.edit")) lockedReason = "ليست لديك صلاحية تعديل المواد.";
  else if (st === "archived") lockedReason = "المادة مؤرشفة. استعدها من الأرشيف لتعديلها.";
  else if ((st === "approved" || st === "published") && !hasPermission(user, "content.publish")) {
    lockedReason = "هذه المادة معتمدة أو منشورة، وتعديلها يتطلب صلاحية النشر.";
  }
  const transitions = availableTransitions(item, user, requireReview);

  return (
    <>
      <Link href="/admin/content" className="text-sm text-accent underline underline-offset-4">
        ← المواد
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{item.title}</h1>
        <StatusBadge
          approvalStatus={item.approvalStatus}
          publicationStatus={item.publicationStatus}
        />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        آخر تعديل: {dateFmt.format(item.updatedAt)}
      </p>
      {saved && (
        <p
          role="status"
          className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          تم الحفظ.
        </p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 lg:order-1">
          {lockedReason && (
            <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {lockedReason}
            </p>
          )}
          <ContentForm
            uploadsEnabled={uploadsConfigured()}
            action={updateContentAction}
            id={item.id}
            types={types}
            categories={categories}
            initial={toFormValues(full)}
            canFeature={hasPermission(user, "content.publish")}
            disabled={lockedReason !== null}
            submitLabel="حفظ التعديلات"
          />
        </div>
        <aside className="order-1 space-y-6 lg:order-2">
          <section className="rounded-md border border-border p-4" aria-labelledby="h-flow">
            <h2 id="h-flow" className="mb-3 font-bold">
              الاعتماد والنشر
            </h2>
            <WorkflowPanel id={item.id} transitions={transitions} />
            {requireReview && (
              <p className="mt-3 text-xs text-muted-foreground">
                المراجعة الإلزامية مفعّلة: لا تُنشر المادة قبل اعتمادها.
              </p>
            )}
          </section>
          <section
            className="rounded-md border border-border p-4 text-sm"
            aria-labelledby="h-links"
          >
            <h2 id="h-links" className="mb-3 font-bold">
              روابط
            </h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href={`/admin/content/${item.id}/preview`}
                  className="text-accent underline underline-offset-4"
                >
                  معاينة الصفحة
                </Link>
              </li>
              {st === "published" && (
                <li>
                  <Link
                    href={`/library/${encodeURIComponent(item.slug)}`}
                    className="text-accent underline underline-offset-4"
                  >
                    عرض الصفحة المنشورة
                  </Link>
                </li>
              )}
            </ul>
          </section>
          {hasPermission(user, "content.delete") && (
            <section
              className="rounded-md border border-red-200 p-4 text-sm"
              aria-labelledby="h-danger"
            >
              <h2 id="h-danger" className="mb-2 font-bold text-red-800">
                حذف المادة
              </h2>
              <p className="mb-3 text-muted-foreground">
                يحذف المادة نهائيًا من الموقع وقاعدة البيانات، مهما كانت حالتها.
              </p>
              <DeleteContentButton id={item.id} title={item.title} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
