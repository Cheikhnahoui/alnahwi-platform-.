import type { PermissionKey } from "@/lib/auth/permissions";

export type AdminNavItem = { href: string; label: string; permission?: PermissionKey };

/** Only pages that actually exist are listed. Later phases add entries here. */
export const ADMIN_NAV: AdminNavItem[] = [{ href: "/admin", label: "لوحة المعلومات" }];