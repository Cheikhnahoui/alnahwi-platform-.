/**
 * Permission catalogue and default role mapping.
 * The database is the source of truth at runtime (roles / permissions /
 * role_permissions); these constants seed it and give TypeScript safety.
 */
export const PERMISSIONS = {
  "content.view_drafts": "View unpublished and draft content",
  "content.create": "Create content items",
  "content.edit": "Edit content items",
  "content.review": "Approve content or send it back for changes",
  "content.publish": "Publish and unpublish approved content",
  "content.archive": "Archive content",
  "content.delete": "Permanently delete content items",
  "taxonomy.manage": "Manage categories, tags and content types",
  "pages.edit": "Edit static pages and site information",
  "participations.manage": "Manage scholarly participations",
  "messages.view": "View contact-form messages",
  "users.manage": "Create, deactivate and reset administrator accounts",
  "roles.manage": "Assign roles and permissions",
  "audit.view": "View the administrative audit log",
  "settings.manage": "Change site and security settings",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_KEYS = ["super_admin", "content_manager", "editor", "reviewer"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLES: Record<
  RoleKey,
  { name: string; description: string; permissions: readonly PermissionKey[] }
> = {
  super_admin: {
    name: "المسؤول الرئيسي",
    description: "إدارة كاملة للحسابات والصلاحيات والمحتوى والإعدادات",
    permissions: Object.keys(PERMISSIONS) as PermissionKey[],
  },
  content_manager: {
    name: "مدير المحتوى",
    description: "إدارة المواد والتصنيفات والوسوم والصفحات المسموح بها",
    permissions: [
      "content.view_drafts",
      "content.create",
      "content.edit",
      "content.review",
      "content.publish",
      "content.archive",
      "taxonomy.manage",
      "pages.edit",
      "participations.manage",
      "messages.view",
    ],
  },
  editor: {
    name: "المحرر",
    description: "إنشاء المواد وتعديلها وحفظ المسودات فقط",
    permissions: ["content.view_drafts", "content.create", "content.edit"],
  },
  reviewer: {
    name: "مراجع المحتوى",
    description: "مراجعة المواد والموافقة عليها أو إعادتها للتعديل",
    permissions: ["content.view_drafts", "content.review"],
  },
};

export function roleHasPermission(role: RoleKey, permission: PermissionKey) {
  return ROLES[role].permissions.includes(permission);
}
