import Link from "next/link";
import { Calendar, Clock, Feather, FileText, Play } from "lucide-react";
import type { ContentListItem } from "@/lib/content/queries";
import { formatDateNumeric, formatDurationWords, safeHttpUrl } from "@/lib/format";
import { typeUi } from "./content-type-ui";

const ACTION_ICON = { play: Play, file: FileText, feather: Feather } as const;

export function ContentCard({ item }: { item: ContentListItem }) {
  const date = formatDateNumeric(item.publishedAt);
  const duration = formatDurationWords(item.durationSeconds);
  const thumb = safeHttpUrl(item.thumbnailUrl);
  const ui = typeUi(item.typeKey);
  const Action = ACTION_ICON[ui.action];
  return (
    <article className="relative flex w-full flex-col overflow-hidden rounded-lg border border-line bg-[#faf9f5] shadow-card transition-colors focus-within:border-brand hover:border-brand/40">
      <div className="relative aspect-[3.94/1] w-full overflow-hidden">
        {thumb ? (
          // External thumbnail hosts are not known in advance, so next/image is not used here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center"
            style={{ background: ui.tile.bg, color: ui.tile.fg }}
          >
            <ui.Icon size={26} strokeWidth={1.4} className="opacity-50" />
          </div>
        )}
        <span
          className="absolute start-2.5 top-2 rounded-md px-2.5 py-0.5 text-[11px] font-semibold leading-5 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
          style={{ background: ui.badge.bg, color: ui.badge.fg }}
        >
          {item.typeName}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-3.5 pb-2.5 pt-1.5">
        <h3 className="line-clamp-2 text-[12.5px] font-bold leading-snug text-ink">
          <Link
            href={`/library/${encodeURIComponent(item.slug)}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[#6b6b66]">
            {date && (
              <li className="flex items-center gap-1">
                <Calendar aria-hidden size={12} />
                <span className="ltr-isolate">{date}</span>
              </li>
            )}
            {duration && (
              <li className="flex items-center gap-1">
                <Clock aria-hidden size={12} />
                {duration}
              </li>
            )}
          </ul>
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eceae4] text-ink"
          >
            <Action size={11} />
          </span>
        </div>
      </div>
    </article>
  );
}
