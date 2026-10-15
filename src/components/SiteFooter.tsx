import Link from "next/link";
import { NAV_ITEMS, POLICY_ROUTES } from "./nav-items";

export function SiteFooter({ pageLinks }: { pageLinks: { key: string; title: string }[] }) {
  const policies = pageLinks.filter((p) => POLICY_ROUTES[p.key]);
  return (
    <footer className="mt-16 border-t border-border bg-muted">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="text-lg font-bold">الموقع الرسمي للشيخ عبد الرحمن النحوي</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            مكتبة علمية رقمية تجمع المواد العلمية المتاحة وتنظمها. النسخة الحالية باللغة العربية.
          </p>
        </div>
        <nav aria-label="روابط الموقع">
          <p className="mb-2 font-semibold">الموقع</p>
          <ul className="space-y-1 text-sm">
            {NAV_ITEMS.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="text-muted-foreground hover:text-foreground">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {policies.length > 0 && (
          <nav aria-label="السياسات">
            <p className="mb-2 font-semibold">السياسات</p>
            <ul className="space-y-1 text-sm">
              {policies.map((p) => (
                <li key={p.key}>
                  <Link
                    href={POLICY_ROUTES[p.key]}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          © الموقع الرسمي للشيخ عبد الرحمن النحوي
        </p>
      </div>
    </footer>
  );
}