import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { MainNav } from "./MainNav";
import { NAV_ITEMS } from "./nav-items";

export function SiteHeader() {
  return (
    <header className="relative z-20 h-[59px] border-b border-line bg-[#f8f7f2] shadow-[0_1px_6px_rgba(16,67,60,0.05)]">
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-4 px-4 lg:px-[72px]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="الصفحة الرئيسية">
          <BrandLogo className="h-[54px]" />
          <span className="leading-tight">
            <span className="block text-[11px] text-[#3b4a4a]">الموقع الرسمي للشيخ</span>
            <span className="block text-[14px] font-bold text-ink">عبد الرحمن النحوي</span>
          </span>
        </Link>

        {/* usePathname()/useSearchParams() inside MainNav need a Suspense boundary; the fallback is the same links, unhighlighted. */}
        <Suspense
          fallback={
            <nav
              aria-label="التنقل الرئيسي"
              className="hidden flex-1 items-center justify-center gap-[30px] lg:flex"
            >
              {NAV_ITEMS.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className="text-[12px] font-semibold text-[#26413b]"
                >
                  {i.label}
                </Link>
              ))}
            </nav>
          }
        >
          <MainNav items={NAV_ITEMS} />
        </Suspense>

        <form
          action="/library"
          method="get"
          role="search"
          className="hidden h-8 w-[180px] shrink-0 items-center rounded-full border border-[#e3dfd6] bg-[#fbfaf7] ps-4 pe-1 lg:flex"
        >
          <label htmlFor="site-search" className="sr-only">
            ابحث في الموقع
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            maxLength={100}
            placeholder="ابحث في الموقع..."
            className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-[#8a8a85]"
          />
          <button
            type="submit"
            aria-label="بحث"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink"
          >
            <Search aria-hidden size={15} />
          </button>
        </form>
      </div>
    </header>
  );
}
