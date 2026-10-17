import type { Metadata } from "next";
import { EmptyState } from "@/components/EmptyState";
import { requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "غير مصرّح" };

export default async function ForbiddenPage() {
  await requireUser();
  return (
    <EmptyState
      title="ليست لديك صلاحية لهذه الصفحة"
      description="إذا كنت تحتاج إليها فاطلب من المسؤول الرئيسي تعديل صلاحياتك."
      action={{ href: "/admin", label: "العودة إلى لوحة المعلومات" }}
    />
  );
}