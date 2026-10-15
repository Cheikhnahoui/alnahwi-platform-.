import { Search } from "lucide-react";

/** Plain GET form: works without JavaScript and keeps results shareable by URL. */
export function SearchBar({
  action = "/library",
  defaultValue = "",
  size = "md",
}: {
  action?: string;
  defaultValue?: string;
  size?: "md" | "lg";
}) {
  const big = size === "lg";
  return (
    <form action={action} method="get" role="search" className="flex w-full gap-2">
      <label htmlFor={`q-${action}`} className="sr-only">
        ابحث في المواد العلمية
      </label>
      <input
        id={`q-${action}`}
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={100}
        placeholder="ابحث بعنوان المادة أو وصفها أو وسومها"
        className={`min-w-0 flex-1 rounded-md border border-border bg-background px-4 outline-none transition-colors placeholder:text-muted-foreground focus:border-accent ${
          big ? "py-3.5 text-lg" : "py-2.5"
        }`}
      />
      <button
        type="submit"
        className={`inline-flex shrink-0 items-center gap-2 rounded-md bg-accent px-5 font-semibold text-accent-foreground transition-opacity hover:opacity-90 ${
          big ? "py-3.5 text-lg" : "py-2.5"
        }`}
      >
        <Search aria-hidden size={big ? 20 : 18} />
        بحث
      </button>
    </form>
  );
}