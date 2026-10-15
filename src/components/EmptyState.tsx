import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-muted-foreground">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-block rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}