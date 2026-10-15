import type { ContentListItem } from "@/lib/content/queries";
import { ContentCard } from "./ContentCard";

export function ContentGrid({ items }: { items: ContentListItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="flex">
          <div className="flex w-full">
            <ContentCard item={item} />
          </div>
        </li>
      ))}
    </ul>
  );
}