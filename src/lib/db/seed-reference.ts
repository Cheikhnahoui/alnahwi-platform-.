/**
 * Reference data required for the system to function: roles, permissions,
 * content types, default settings and empty static-page shells.
 * This contains NO scholarly content and NO biographical claims.
 * Idempotent: safe to run repeatedly.
 */
import { eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { PERMISSIONS, ROLES, type PermissionKey, type RoleKey } from "@/lib/auth/permissions";
import * as s from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<any, typeof s>;

export const DEFAULT_CONTENT_TYPES = [
  { key: "lecture", name: "محاضرة" },
  { key: "lesson", name: "درس" },
  { key: "audio", name: "تسجيل صوتي" },
  { key: "research", name: "بحث" },
  { key: "article", name: "مقال" },
  { key: "book", name: "كتاب أو ملف PDF" },
  { key: "participation", name: "مشاركة علمية" },
  { key: "seminar", name: "ندوة أو مؤتمر" },
  { key: "poem", name: "قصيدة أو نص علمي" },
  { key: "khawatir", name: "خواطر" },
  { key: "other", name: "مادة أخرى" },
] as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  // Mandatory review before publishing. Off in v1, switchable later.
  "workflow.require_review": false,
  "site.show_news": false,
  "site.show_participations": true,
  "site.archived_in_library": false,
  "site.name": "الموقع الرسمي للشيخ عبد الرحمن النحوي",
};

export const STATIC_PAGE_SHELLS = [
  { key: "about", title: "عن الشيخ" },
  { key: "privacy", title: "سياسة الخصوصية" },
  { key: "terms", title: "شروط الاستخدام" },
  { key: "copyright_policy", title: "سياسة حقوق النشر وإعادة استخدام المواد" },
] as const;

export async function seedReferenceData(db: AnyDb) {
  // Permissions
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await db
      .insert(s.permissions)
      .values({ key, description })
      .onConflictDoUpdate({ target: s.permissions.key, set: { description } });
  }
  const permRows = await db.select().from(s.permissions);
  const permId = new Map(permRows.map((p) => [p.key, p.id]));

  // Roles and their permissions
  for (const [roleKey, def] of Object.entries(ROLES) as [RoleKey, (typeof ROLES)[RoleKey]][]) {
    const [role] = await db
      .insert(s.roles)
      .values({ key: roleKey, name: def.name, description: def.description })
      .onConflictDoUpdate({
        target: s.roles.key,
        set: { name: def.name, description: def.description },
      })
      .returning();
    await db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, role.id));
    await db.insert(s.rolePermissions).values(
      def.permissions.map((p: PermissionKey) => ({
        roleId: role.id,
        permissionId: permId.get(p)!,
      })),
    );
  }

  // Content types (names stay editable by admins after first seed)
  for (const [i, t] of DEFAULT_CONTENT_TYPES.entries()) {
    await db
      .insert(s.contentTypes)
      .values({ key: t.key, name: t.name, sortOrder: i })
      .onConflictDoNothing({ target: s.contentTypes.key });
  }

  // Settings (do not overwrite values already changed by admins)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db
      .insert(s.siteSettings)
      .values({ key, value })
      .onConflictDoNothing({ target: s.siteSettings.key });
  }

  // Static page shells: unpublished and empty until verified content is added
  for (const p of STATIC_PAGE_SHELLS) {
    await db
      .insert(s.staticPages)
      .values({ key: p.key, title: p.title })
      .onConflictDoNothing({ target: s.staticPages.key });
  }

  return { roles: Object.keys(ROLES).length, permissions: Object.keys(PERMISSIONS).length };
}
