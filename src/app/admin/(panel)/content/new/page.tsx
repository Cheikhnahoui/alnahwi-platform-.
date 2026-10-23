import type { Metadata } from "next";
import Link from "next/link";
import { ContentForm } from "@/components/ContentForm";
import { uploadsConfigured } from "@/lib/storage/store";
import { listCategoryOptions, listTypeOptions } from "@/lib/admin/content";
import { EMPTY_FORM } from "@/lib/admin/content-form-values";
import { hasPermission } from "@/lib/admin/workflow";
import { requirePermission } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { createContentAction } from "../actions";

export const metadata: Metadata = { title: "مادة جديدة" };

export default async function NewContentPage() {
  const user = await requirePermission("content.create");
  const db = getDb();
  const [types, categories] = await Promise.all([listTypeOptions(db), listCategoryOptions(db)]);
  return (
    <>
      <Link href="/admin/content" className="text-sm text-accent underline underline-offset-4">
        ← المواد
      </Link>
      <h1 className="mt-3 mb-2 text-2xl font-bold">مادة جديدة</h1>
      <p className="mb-8 text-muted-foreground">
        تُحفظ المادة مسودةً غير ظاهرة للزوار حتى تُعتمد وتُنشر.
      </p>
      <div className="max-w-3xl">
        <ContentForm
          uploadsEnabled={uploadsConfigured()}
          action={createContentAction}
          types={types}
          categories={categories}
          initial={EMPTY_FORM}
          canFeature={hasPermission(user, "content.publish")}
          submitLabel="حفظ كمسودة"
        />
      </div>
    </>
  );
}
