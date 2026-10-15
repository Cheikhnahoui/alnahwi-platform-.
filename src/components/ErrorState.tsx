"use client";

export function ErrorState({
  title = "تعذّر تحميل الصفحة",
  description = "حدثت مشكلة أثناء جلب المحتوى. حاول مرة أخرى بعد قليل.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-md border border-border px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-foreground hover:opacity-90"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}