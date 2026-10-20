import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentDetailView } from "@/components/ContentDetailView";
import { PageContainer } from "@/components/PageContainer";
import { StatusBadge } from "@/components/StatusBadge";
import { getAdminContent, getContentPreview } from "@/lib/admin/content";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "معاينة" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("content.view_drafts");
  const { id } = await params;
  const db = getDb();
  const [item, full] = await Promise.all([getContentPreview(db, id), getAdminContent(db, id)]);
  if (!item || !full) notFound();
  return (
    <>
      <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="flex items-center gap-2">
          معاينة داخلية، لا يراها الزوار إلا بعد النشر.
          <StatusBadge
            approvalStatus={full.item.approvalStatus}
            publicationStatus={full.item.publicationStatus}
          />
        </span>
        <Link href={`/admin/content/${id}`} className="font-semibold underline underline-offset-4">
          العودة إلى التعديل
        </Link>
      </div>
      <PageContainer narrow>
        <ContentDetailView item={item} />
      </PageContainer>
    </>
  );
}
