export type NavItem = { readonly href: string; readonly label: string };

/** Main navigation, in the order of the approved design. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/about", label: "التعريف بالشيخ" },
  { href: "/library", label: "المكتبة العلمية" },
  { href: "/library?type=participation", label: "المشاركات العلمية" },
  { href: "/categories", label: "التصنيفات" },
  { href: "/library?type=poem", label: "قصائد الشيخ" },
];

/** The contact page is not built yet; flip this when /contact exists. */
export const CONTACT_PAGE_READY = false;

/** Footer link row of the approved design. */
export const FOOTER_LINKS: readonly NavItem[] = [
  { href: "/", label: "الرئيسية" },
  { href: "/about", label: "التعريف بالشيخ" },
  { href: "/library?type=participation", label: "المشاركات العلمية" },
  ...(CONTACT_PAGE_READY ? [{ href: "/contact", label: "التواصل معنا" }] : []),
];

/** Policy pages: shown in the footer only once published with content. */
export const POLICY_ROUTES: Record<string, string> = {
  privacy: "/privacy",
  terms: "/terms",
  copyright_policy: "/copyright",
};
