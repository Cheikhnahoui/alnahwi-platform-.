import Link from "next/link";
import { Calendar, Clock, User } from "lucide-react";
import type { ContentListItem } from "@/lib/content/queries";
import { formatDate, formatDuration, safeHttpUrl } from "@/lib/format";

export function ContentCard({ item }: { item: ContentListItem }) {
  const date = formatDate(item.publishedAt);
  const duration = formatDuration(item.durationSeconds);
  const thumb = safeHttpUrl(item.thumbnailUrl);
  return (
    <article className="relative flex flex-col overflow-hidden rounded-md border border-border bg-background transition-colors focus-within:border-accent hover:border-foreground/40">
      {thumb && (
        // External thumbnail hosts are not known in advance, so next/image is not used here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" loading="lazy" className="aspect-video w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-sm font-semibold text-accent">{item.typeName}</p>
        <h3 className="line-clamp-2 text-lg font-bold leading-snug">
          <Link
            href={`/library/${encodeURIComponent(item.slug)}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {item.title}
          </Link>
        </h3>
        {item.summary && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
        )}
        {(item.speakerName || date || duration) && (
          <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 text-xs text-muted-foreground">
            {item.speakerName && (
              <li className="flex items-center gap-1">
                <User aria-hidden size={14} />
                {item.speakerName}
              </li>
            )}
            {date && (
              <li className="flex items-center gap-1">
                <Calendar aria-hidden size={14} />
                {date}
              </li>
            )}
            {duration && (
              <li className="flex items-center gap-1">
                <Clock aria-hidden size={14} />
                <span className="ltr-isolate">{duration}</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </article>
  );
}