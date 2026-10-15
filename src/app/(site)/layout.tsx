import { Suspense } from "react";
import { connection } from "next/server";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { listPublishedPageLinksCached } from "@/lib/content/public";

async function FooterWithLinks() {
  await connection(); // keep the database out of `next build`
  let links: { key: string; title: string }[] = [];
  try {
    links = await listPublishedPageLinksCached();
  } catch (err) {
    console.error("Footer: could not load page links", err instanceof Error ? err.message : err);
  }
  return <SiteFooter pageLinks={links} />;
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        انتقل إلى المحتوى
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Suspense fallback={<SiteFooter pageLinks={[]} />}>
        <FooterWithLinks />
      </Suspense>
    </>
  );
}