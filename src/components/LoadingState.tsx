/** Skeleton shown while content streams in. Respects reduced motion via globals.css. */
export function LoadingState({ cards = 6 }: { cards?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">جارٍ التحميل…</span>
      <ul aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <li key={i} className="h-40 animate-pulse rounded-md border border-border bg-muted" />
        ))}
      </ul>
    </div>
  );
}