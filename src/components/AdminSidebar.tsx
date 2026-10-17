import Link from "next/link";
import { can, type SessionUser } from "@/lib/auth/session";
import { ADMIN_NAV } from "./AdminNav";

export function AdminSidebar({ user }: { user: SessionUser }) {
  const items = ADMIN_NAV.filter((i) => !i.permission || can(user, i.permission));
  return (
    <aside className="hidden w-60 shrink-0 border-e border-border bg-muted md:block">
      <div className="px-5 py-5">
        <p className="text-sm text-muted-foreground">لوحة التحكم</p>
        <p className="font-bold">الموقع الرسمي للشيخ</p>
      </div>
      <nav aria-label="قائمة الإدارة" className="px-3">
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="block rounded-md px-3 py-2 text-sm hover:bg-background"
              >
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}