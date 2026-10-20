import type { AnyDb } from "@/lib/db/types";
import * as s from "@/lib/db/schema";

/** Arabic labels for audit entries. Unknown actions fall back to the raw key. */
export const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "تسجيل دخول",
  "user.create": "إنشاء حساب إداري",
  "user.update": "تعديل حساب إداري",
  "user.disable": "تعطيل حساب",
  "user.enable": "تفعيل حساب",
  "user.password_reset": "إعادة تعيين كلمة مرور",
  "content.create": "إنشاء مادة",
  "content.update": "تعديل مادة",
  "content.submit": "إرسال مادة للمراجعة",
  "content.approve": "اعتماد مادة",
  "content.request_changes": "إعادة مادة للتعديل",
  "content.restore": "استعادة مادة من الأرشيف",
  "content.publish": "نشر مادة",
  "content.unpublish": "إلغاء نشر مادة",
  "content.archive": "أرشفة مادة",
  "content.delete": "حذف مادة",
  "page.update": "تعديل صفحة",
  "taxonomy.update": "تعديل التصنيفات أو الوسوم",
  "setting.update": "تعديل الإعدادات",
};

/**
 * Records an administrative action. `metadata` must never contain passwords,
 * tokens, message bodies or other sensitive data.
 */
export async function writeAudit(
  db: AnyDb,
  entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await db.insert(s.auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
}
