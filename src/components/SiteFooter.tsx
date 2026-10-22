import Link from "next/link";
import { Send } from "lucide-react";
import type { SocialLinks } from "@/lib/content/queries";
import { BrandMark } from "./BrandMark";
import { FOOTER_LINKS, POLICY_ROUTES } from "./nav-items";

function YouTubeIcon() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.3 5 12 5 12 5s-6.3 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2C2 8.75 2 12 2 12s0 3.25.4 4.8a2.5 2.5 0 0 0 1.76 1.77C5.7 19 12 19 12 19s6.3 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77C22 15.25 22 12 22 12s0-3.25-.4-4.8ZM10 15V9l5.2 3Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function SiteFooter({
  pageLinks,
  social = {},
  year,
}: {
  pageLinks: { key: string; title: string }[];
  social?: SocialLinks;
  year?: number;
}) {
  const policies = pageLinks.filter((p) => POLICY_ROUTES[p.key]);
  // Listed right-to-left (RTL), so the screen shows YouTube, X, Telegram from the left, as designed.
  const socials = [
    { href: social.telegram, label: "قناة تيليجرام", icon: <Send aria-hidden size={13} /> },
    { href: social.x, label: "حساب إكس", icon: <XIcon /> },
    { href: social.youtube, label: "قناة اليوتيوب", icon: <YouTubeIcon /> },
  ].filter((s) => s.href);

  return (
    <footer className="relative mt-4 overflow-hidden bg-footer text-white">
      {/* Corner ornaments (decorative) */}
      <div
        aria-hidden
        className="pattern-lattice absolute inset-y-0 start-0 hidden w-[110px] opacity-25 [mask-image:linear-gradient(to_left,#000,transparent)] md:block"
      />
      <div
        aria-hidden
        className="pattern-lattice absolute inset-y-0 end-0 hidden w-[110px] opacity-25 [mask-image:linear-gradient(to_right,#000,transparent)] md:block"
      />
      <div className="relative mx-auto grid min-h-[106px] max-w-[1104px] items-center gap-5 px-4 pb-5 pt-[17px] md:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start">
          <div className="flex items-center gap-2.5">
            <BrandMark size={36} className="text-[#d9c28b]" />
            <p className="leading-tight">
              <span className="block text-[11px] text-white/85">الموقع الرسمي للشيخ</span>
              <span className="block text-[14px] font-bold">عبد الرحمن النحوي</span>
            </p>
          </div>
          <p className="mt-2 text-[10px] text-white/80">
            جميع الحقوق محفوظة {year ? <>© {year} · </> : null}الموقع الرسمي للشيخ عبد الرحمن النحوي
          </p>
        </div>

        <nav aria-label="روابط الموقع" className="justify-self-center">
          <ul className="flex flex-wrap items-center justify-center gap-y-1 text-[11px]">
            {[
              ...FOOTER_LINKS,
              ...policies.map((p) => ({ href: POLICY_ROUTES[p.key], label: p.title })),
            ].map((l, i) => (
              <li
                key={l.href}
                className={`px-5 ${i > 0 ? "border-s border-white/30" : ""} leading-[14px]`}
              >
                <Link href={l.href} className="text-white/90 hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {socials.length > 0 ? (
          <ul className="flex items-center justify-self-end gap-[9px]" aria-label="وسائل التواصل">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-white/60 text-white hover:bg-white/10"
                >
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <span aria-hidden />
        )}
      </div>
    </footer>
  );
}
