export const NAV_ITEMS = [
  { href: "/", label: "الرئيسية" },
  { href: "/library", label: "المكتبة" },
  { href: "/categories", label: "التصنيفات" },
  { href: "/about", label: "عن الشيخ" },
] as const;

/** Policy pages: shown in the footer only once published with content. */
export const POLICY_ROUTES: Record<string, string> = {
  privacy: "/privacy",
  terms: "/terms",
  copyright_policy: "/copyright",
};