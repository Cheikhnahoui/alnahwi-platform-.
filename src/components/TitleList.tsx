import Link from "next/link";
import type { ContentListItem } from "@/lib/content/queries";

/** Plain list of titles (no cards, no thumbnails, no description). */
export function TitleList({ items }: { items: ContentListItem[] }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/library/${encodeURIComponent(item.slug)}`}
            className="block px-4 py-4 text-lg font-semibold hover:bg-muted focus-visible:bg-muted"
          >
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
