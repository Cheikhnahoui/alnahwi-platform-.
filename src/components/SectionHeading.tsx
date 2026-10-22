import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function SectionHeading({
  title,
  href,
  linkLabel = "عرض الكل",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-[15px]">
        <h2 className="text-[20px] font-bold leading-tight text-ink">{title}</h2>
        <span aria-hidden className="h-px w-8 bg-gold/70" />
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink hover:underline"
        >
          {linkLabel}
          <ArrowLeft aria-hidden size={14} />
        </Link>
      )}
    </div>
  );
}
