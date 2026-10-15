import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ContentGrid } from "@/components/ContentGrid";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { SearchBar } from "@/components/SearchBar";
import { SectionHeading } from "@/components/SectionHeading";
import { getHomeDataCached } from "@/lib/content/public";
import { formatDate } from "@/lib/format";

const KIND_LABELS: Record<string, string> = {
  conference: "مؤتمر",
  seminar: "ندوة",
  public_lesson: "درس عام",
  event: "فعالية",
  other: "مشاركة",
};

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pattern-star absolute inset-y-0 start-auto end-0 w-2/3 sm:w-1/2"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl sm:leading-tight">
            الموقع الرسمي للشيخ عبد الرحمن النحوي
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            مكتبة علمية رقمية تجمع المواد العلمية المتاحة وتنظمها، لتصل إليها بالبحث أو بالتصنيف.
          </p>
          <div className="mt-8 max-w-2xl">
            <SearchBar size="lg" />
          </div>
        </div>
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <LoadingState />
          </div>
        }
      >
        <HomeSections />
      </Suspense>
    </>
  );
}

async function HomeSections() {
  await connection(); // keep the database out of `next build`
  const d = await getHomeDataCached();

  if (d.totalPublished === 0 && !d.aboutExcerpt && d.participations.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <EmptyState
          title="لا توجد مواد منشورة بعد"
          description="ستظهر المواد العلمية والأقسام هنا عند نشرها."
        />
      </div>
    );
  }

  const section = "mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6";
  return (
    <div className="pb-4">
      {d.aboutExcerpt && (
        <section className={section} aria-labelledby="h-about">
          <SectionHeading title="عن الشيخ" href="/about" linkLabel="اقرأ المزيد" />
          <h2 id="h-about" className="sr-only">
            عن الشيخ
          </h2>
          <p className="max-w-[68ch] whitespace-pre-line text-[1.0625rem]">{d.aboutExcerpt}</p>
        </section>
      )}

      {d.latest.length > 0 && (
        <section className={section}>
          <SectionHeading title="أحدث المواد" href="/library" />
          <ContentGrid items={d.latest} />
        </section>
      )}

      {d.featured.length > 0 && (
        <section className={section}>
          <SectionHeading title="مواد مختارة" />
          <ContentGrid items={d.featured} />
        </section>
      )}

      {d.lectures.length > 0 && (
        <section className={section}>
          <SectionHeading title="المحاضرات والدروس" href="/library?type=lecture" />
          <ContentGrid items={d.lectures} />
        </section>
      )}

      {d.writings.length > 0 && (
        <section className={section}>
          <SectionHeading title="الكتب والبحوث والمقالات" href="/library?type=research" />
          <ContentGrid items={d.writings} />
        </section>
      )}

      {d.categories.length > 0 && (
        <section className={section}>
          <SectionHeading title="التصنيفات العلمية" href="/categories" />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/categories/${encodeURIComponent(c.slug)}`}
                  className="flex h-full items-center justify-between gap-3 rounded-md border border-border px-4 py-3 transition-colors hover:border-accent"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.participations.length > 0 && (
        <section className={section}>
          <SectionHeading title="المشاركات العلمية" />
          <ul className="divide-y divide-border rounded-md border border-border">
            {d.participations.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="font-semibold">{p.title}</span>
                <span className="text-sm text-muted-foreground">
                  {[KIND_LABELS[p.kind], p.location, formatDate(p.eventDate)]
                    .filter(Boolean)
                    .join(" — ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.totalPublished > 0 && (
        <section className={`${section} text-center`}>
          <Link
            href="/library"
            className="inline-block rounded-md bg-accent px-8 py-3 text-lg font-semibold text-accent-foreground hover:opacity-90"
          >
            تصفّح المكتبة كاملة ({d.totalPublished})
          </Link>
        </section>
      )}
    </div>
  );
}