import Link from "next/link";

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
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm text-accent underline underline-offset-4">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}