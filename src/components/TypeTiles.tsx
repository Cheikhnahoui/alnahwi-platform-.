import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { typeUi } from "./content-type-ui";

/** Shortcuts into the library, one per content type of the approved design. */
const TILES = [
  { type: "lecture", title: "محاضرات ودروس", subtitle: "محاضرات ودروس مسجلة" },
  { type: "lesson", title: "دروس", subtitle: "دروس علمية متنوعة" },
  { type: "audio", title: "تسجيل صوتي", subtitle: "مواد صوتية مختارة" },
  { type: "research", title: "بحث", subtitle: "أبحاث ودراسات علمية" },
  { type: "article", title: "مقالات", subtitle: "مقالات ومشاركات علمية" },
  { type: "poem", title: "قصائد الشيخ", subtitle: "قصائد ونصوص علمية" },
] as const;

export function TypeTiles() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-[15px]">
      {TILES.map((t) => {
        const ui = typeUi(t.type);
        return (
          <li key={t.type} className="flex">
            <Link
              href={`/library?type=${t.type}`}
              className="relative flex min-h-[104px] w-full flex-col rounded-lg border border-line bg-[#faf9f5] px-[15px] pb-3 pt-[13px] shadow-card transition-colors hover:border-brand/40"
            >
              <span
                aria-hidden
                className="flex h-[34px] w-[36px] items-center justify-center rounded-lg"
                style={{ background: ui.tile.bg, color: ui.tile.fg }}
              >
                <ui.Icon size={19} strokeWidth={1.7} />
              </span>
              <span className="mt-[7px] text-[13px] font-bold leading-tight text-ink">
                {t.title}
              </span>
              <span className="mt-1 text-[10.5px] leading-tight text-[#7a7a75]">{t.subtitle}</span>
              <ChevronLeft
                aria-hidden
                size={14}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-[#6b6b66]"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
