import type { ContentListItem } from "@/lib/content/queries";
import { ContentCard } from "./ContentCard";

const COLUMNS = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function ContentGrid({
  items,
  columns = 3,
}: {
  items: ContentListItem[];
  columns?: keyof typeof COLUMNS;
}) {
  return (
    <ul className={`grid gap-[15px] ${COLUMNS[columns]}`}>
      {items.map((item) => (
        <li key={item.id} className="flex">
          <ContentCard item={item} />
        </li>
      ))}
    </ul>
  );
}
