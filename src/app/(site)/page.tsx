import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ContentGrid } from "@/components/ContentGrid";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { HomeHero } from "@/components/HomeHero";
import { TypeTiles } from "@/components/TypeTiles";
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
      <HomeHero />
      <section aria-label="أنواع المواد" className="mx-auto w-full max-w-[1104px] px-4 pt-[34px]">
        <TypeTiles />
      </section>

      <Suspense
        fallback={
          <div className="mx-auto max-w-[1104px] px-4 py-10">
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
      <div className="mx-auto max-w-[1104px] px-4 py-12">
        <EmptyState
          title="لا توجد مواد منشورة بعد"
          description="ستظهر المواد العلمية والأقسام هنا عند نشرها."
        />
      </div>
    );
  }

  const section = "mx-auto w-full max-w-[1104px] px-4 pt-[27px]";
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
          <SectionHeading title="أحدث المواد العلمية" href="/library" />
          <ContentGrid items={d.latest.slice(0, 4)} columns={4} />
        </section>
      )}

      {d.featured.length > 0 && (
        <section className={section}>
          <SectionHeading title="مواد مختارة" />
          <ContentGrid items={d.featured} columns={4} />
        </section>
      )}

      {d.lectures.length > 0 && (
        <section className={section}>
          <SectionHeading title="المحاضرات والدروس" href="/library?type=lecture" />
          <ContentGrid items={d.lectures} columns={4} />
        </section>
      )}

      {d.writings.length > 0 && (
        <section className={section}>
          <SectionHeading title="الكتب والبحوث والمقالات" href="/library?type=research" />
          <ContentGrid items={d.writings} columns={4} />
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
            className="inline-block rounded-md bg-brand px-8 py-3 text-lg font-semibold text-white hover:opacity-90"
          >
            تصفّح المكتبة كاملة ({d.totalPublished})
          </Link>
        </section>
      )}
    </div>
  );
}
