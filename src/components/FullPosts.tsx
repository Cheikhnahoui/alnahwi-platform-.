import Link from "next/link";
import type { FullTextItem } from "@/lib/content/queries";
import { toParagraphs } from "@/lib/format";

/** Every post in its own card: title, then the complete text. No truncation. */
export function FullPosts({ items }: { items: FullTextItem[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      {items.map((item) => {
        const hasText = Boolean(item.summary || item.description);
        return (
          <article
            key={item.id}
            className="rounded-md border border-border bg-background p-5 sm:p-8"
          >
            <h2 className="text-2xl font-bold leading-snug sm:text-3xl sm:leading-snug">
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-5 text-lg font-medium whitespace-pre-line">{item.summary}</p>
            )}
            <div className="mt-5 space-y-4 text-[1.0625rem] leading-loose">
              {toParagraphs(item.description).map((p, i) => (
                // whitespace-pre-line keeps the author's single line breaks.
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
            {!hasText && (
              // No written text (e.g. a recording): send the reader to the item's own page.
              <p className="mt-5">
                <Link
                  href={`/library/${encodeURIComponent(item.slug)}`}
                  className="font-semibold text-accent underline underline-offset-4"
                >
                  فتح المادة
                </Link>
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
