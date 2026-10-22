import { Suspense } from "react";
import { connection } from "next/server";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSocialLinksCached, listPublishedPageLinksCached } from "@/lib/content/public";
import type { SocialLinks } from "@/lib/content/queries";

async function FooterWithLinks() {
  await connection(); // keep the database out of `next build`
  let links: { key: string; title: string }[] = [];
  let social: SocialLinks = {};
  try {
    [links, social] = await Promise.all([listPublishedPageLinksCached(), getSocialLinksCached()]);
  } catch (err) {
    console.error("Footer: could not load page links", err instanceof Error ? err.message : err);
  }
  return <SiteFooter pageLinks={links} social={social} year={new Date().getFullYear()} />;
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-paper">
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
    </div>
  );
}
