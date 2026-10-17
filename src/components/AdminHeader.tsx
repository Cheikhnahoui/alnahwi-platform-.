import Link from "next/link";
import { logoutAction } from "@/app/admin/login/actions";
import type { SessionUser } from "@/lib/auth/session";
import { ADMIN_NAV } from "./AdminNav";

export function AdminHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="leading-tight">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.roleName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-accent underline underline-offset-4">
            عرض الموقع
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              تسجيل الخروج
            </button>
          </form>
        </div>
      </div>
      <nav aria-label="قائمة الإدارة" className="border-t border-border px-4 py-2 md:hidden">
        <ul className="flex flex-wrap gap-2">
          {ADMIN_NAV.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="rounded-md px-2 py-1 text-sm hover:bg-muted">
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}