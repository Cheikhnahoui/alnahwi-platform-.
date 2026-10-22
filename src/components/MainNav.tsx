"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

type Item = { readonly href: string; readonly label: string };

export function MainNav({ items }: { items: readonly Item[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  // Remember WHERE the menu was opened; it closes by itself after navigating.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  // Items such as /library?type=poem are only "current" for that exact filter,
  // and plain /library is current for every other library view.
  const typeParam = params.get("type");
  const queryTypes = items.flatMap((i) => {
    const t = new URL(i.href, "http://x").searchParams.get("type");
    return t ? [t] : [];
  });
  const isActive = (href: string) => {
    const u = new URL(href, "http://x");
    const wanted = u.searchParams.get("type");
    if (wanted) return pathname === u.pathname && typeParam === wanted;
    if (u.pathname === "/") return pathname === "/";
    const inside = pathname === u.pathname || pathname.startsWith(`${u.pathname}/`);
    return u.pathname === "/library" && pathname === "/library"
      ? inside && !(typeParam && queryTypes.includes(typeParam))
      : inside;
  };

  const linkClass = (href: string) =>
    `relative flex items-center text-[12px] font-semibold transition-colors ${
      isActive(href) ? "text-ink" : "text-[#26413b] hover:text-ink"
    }`;
  const underline =
    "after:absolute after:inset-x-0 after:bottom-[10px] after:h-[2px] after:bg-[#958168] after:content-['']";

  return (
    <div className="flex flex-1 items-center justify-center">
      <nav aria-label="التنقل الرئيسي" className="hidden items-stretch gap-[30px] lg:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`${linkClass(i.href)} h-[59px] ${isActive(i.href) ? underline : ""}`}
            aria-current={isActive(i.href) ? "page" : undefined}
          >
            {i.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="ms-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-line lg:hidden"
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
          className="absolute inset-x-0 top-full z-30 border-b border-line bg-[#f8f7f2] px-4 pb-4 pt-2 lg:hidden"
        >
          <ul className="flex flex-col">
            {items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  className={`block py-3 text-[15px] font-semibold ${
                    isActive(i.href) ? "text-ink" : "text-[#26413b]"
                  }`}
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
