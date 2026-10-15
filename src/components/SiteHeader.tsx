import { Suspense } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { MainNav } from "./MainNav";
import { NAV_ITEMS } from "./nav-items";

export function SiteHeader() {
  return (
    <header className="relative border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="الصفحة الرئيسية">
          {/* Provisional logo slot: replace with the official identity once approved. */}
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-accent"
          >
            <BookOpen size={22} strokeWidth={1.6} />
          </span>
          <span className="leading-tight">
            <span className="block text-[0.8rem] text-muted-foreground">الموقع الرسمي</span>
            <span className="block text-base font-bold sm:text-lg">الشيخ عبد الرحمن النحوي</span>
          </span>
        </Link>
        {/* usePathname() inside MainNav needs a Suspense boundary; the fallback is the same links, unhighlighted. */}
        <Suspense
          fallback={
            <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className="rounded-md px-3 py-2 text-[0.95rem] text-foreground/80"
                >
                  {i.label}
                </Link>
              ))}
            </nav>
          }
        >
          <MainNav items={NAV_ITEMS} />
        </Suspense>
      </div>
    </header>
  );
}