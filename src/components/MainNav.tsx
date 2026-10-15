"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

type Item = { readonly href: string; readonly label: string };

export function MainNav({ items }: { items: readonly Item[] }) {
  const pathname = usePathname();
  // Remember WHERE the menu was opened; it closes by itself after navigating.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    `rounded-md px-3 py-2 text-[0.95rem] transition-colors ${
      isActive(href)
        ? "font-semibold text-accent"
        : "text-foreground/80 hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="flex items-center">
      <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 md:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={linkClass(i.href)}
            aria-current={isActive(i.href) ? "page" : undefined}
          >
            {i.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border md:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
        onClick={() => setOpenAt(open ? null : pathname)}
      >
        {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
      </button>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="التنقل الرئيسي"
          className="absolute inset-x-0 top-full z-30 border-b border-border bg-background px-4 pb-4 pt-2 md:hidden"
        >
          <ul className="flex flex-col">
            {items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  className={`block ${linkClass(i.href)} py-3`}
                  aria-current={isActive(i.href) ? "page" : undefined}
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}