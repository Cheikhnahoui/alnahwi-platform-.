import Link from "next/link";
import { Calendar, Clock, ExternalLink, User } from "lucide-react";
import type { ContentDetail } from "@/lib/content/queries";
import { ContentGrid } from "@/components/ContentGrid";
import { MediaPlayer } from "@/components/MediaPlayer";
import { resolvePlayer } from "@/lib/media";
import {
  formatDate,
  formatDuration,
  PERMISSION_LABELS,
  safeHttpUrl,
  SOURCE_KIND_LABELS,
  toParagraphs,
} from "@/lib/format";

/** One item exactly as visitors see it. Shared by the public page and the admin preview. */
export function ContentDetailView({ item }: { item: ContentDetail }) {
  const published = formatDate(item.publishedAt);
  const recorded = formatDate(item.recordedAt);
  const duration = formatDuration(item.durationSeconds);
  const thumb = safeHttpUrl(item.thumbnailUrl);
  const downloadAllowed =
    item.permissionStatus === "granted" || item.permissionStatus === "public_domain";
  // Sources that can be played inside the page (the primary one first). The full list of
  // sources, including these, still appears under "المصادر" as plain links.
  const players = item.sources
    .flatMap((src) => {
      const player = resolvePlayer(src.url, src.kind);
      return player ? [{ src, player }] : [];
    })
    .sort((a, b) => Number(b.src.isPrimary) - Number(a.src.isPrimary));
  const hasVideo = players.some((p) => p.player.type !== "audio");
  const chip =
    "rounded-full border border-border px-3 py-1 text-sm hover:border-accent hover:text-accent";

  return (
    <>
      <nav aria-label="مسار التنقل" className="mb-6 text-sm text-muted-foreground">
        <Link href="/library" className="underline underline-offset-4 hover:text-foreground">
          المكتبة
        </Link>
        <span aria-hidden> › </span>
        <span>{item.typeName}</span>
      </nav>

      <article>
        <p className="font-semibold text-accent">{item.typeName}</p>
        <h1 className="mt-1 text-3xl font-bold leading-snug sm:text-4xl sm:leading-snug">
          {item.title}
        </h1>

        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {item.speakerName && (
            <li className="flex items-center gap-1.5">
              <User aria-hidden size={16} /> {item.speakerName}
            </li>
          )}
          {published && (
            <li className="flex items-center gap-1.5">
              <Calendar aria-hidden size={16} /> تاريخ النشر: {published}
            </li>
          )}
          {recorded && (
            <li className="flex items-center gap-1.5">
              <Calendar aria-hidden size={16} /> تاريخ الإلقاء: {recorded}
            </li>
          )}
          {duration && (
            <li className="flex items-center gap-1.5">
              <Clock aria-hidden size={16} /> المدة: <span className="ltr-isolate">{duration}</span>
            </li>
          )}
        </ul>

        {players.length > 0 && (
          <section className="mt-6 space-y-4" aria-label="المشغّل">
            {players.map(({ src, player }) => (
              <figure key={src.id}>
                <MediaPlayer player={player} title={src.sourceName ?? item.title} poster={thumb} />
                {players.length > 1 && (
                  <figcaption className="mt-1 text-sm text-muted-foreground">
                    {src.sourceName ?? SOURCE_KIND_LABELS[src.kind] ?? src.kind}
                  </figcaption>
                )}
              </figure>
            ))}
          </section>
        )}

        {thumb && !hasVideo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="mt-6 aspect-video w-full rounded-md border border-border object-cover"
          />
        )}

        {item.summary && <p className="mt-6 text-lg font-medium">{item.summary}</p>}
        <div className="mt-4 max-w-[68ch] space-y-4 text-[1.0625rem]">
          {toParagraphs(item.description).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {item.sources.length > 0 && (
          <section className="mt-10" aria-labelledby="h-sources">
            <h2 id="h-sources" className="mb-3 text-xl font-bold">
              المصادر
            </h2>
            <ul className="divide-y divide-border rounded-md border border-border">
              {item.sources.map((src) => {
                const url = safeHttpUrl(src.url);
                if (!url) return null;
                return (
                  <li
                    key={src.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <span>
                      <span className="font-semibold">
                        {SOURCE_KIND_LABELS[src.kind] ?? src.kind}
                      </span>
                      {src.sourceName && (
                        <span className="text-muted-foreground"> — {src.sourceName}</span>
                      )}
                    </span>
                    <span className="flex gap-4 text-sm">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-accent underline underline-offset-4"
                      >
                        {src.isDownloadable && downloadAllowed ? "فتح / تحميل" : "فتح المصدر"}
                        <ExternalLink aria-hidden size={14} />
                      </a>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-8 rounded-md bg-muted p-4 text-sm" aria-labelledby="h-rights">
          <h2 id="h-rights" className="mb-1 font-bold">
            الحقوق والإذن
          </h2>
          <p>
            حالة الإذن بإعادة النشر:{" "}
            {PERMISSION_LABELS[item.permissionStatus] ?? item.permissionStatus}
          </p>
          {item.copyrightNotice && <p className="mt-1">{item.copyrightNotice}</p>}
          {item.reuseRestrictions && (
            <p className="mt-1">قيود إعادة الاستخدام: {item.reuseRestrictions}</p>
          )}
        </section>

        {(item.categories.length > 0 || item.tags.length > 0) && (
          <section className="mt-8 space-y-4">
            {item.categories.length > 0 && (
              <div>
                <h2 className="mb-2 font-bold">التصنيفات</h2>
                <ul className="flex flex-wrap gap-2">
                  {item.categories.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/categories/${encodeURIComponent(c.slug)}`} className={chip}>
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.tags.length > 0 && (
              <div>
                <h2 className="mb-2 font-bold">الوسوم</h2>
                <ul className="flex flex-wrap gap-2">
                  {item.tags.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/library?q=${encodeURIComponent(t.name)}`} className={chip}>
                        {t.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </article>

      {item.related.length > 0 && (
        <section className="mt-12" aria-labelledby="h-related">
          <h2 id="h-related" className="mb-4 text-2xl font-bold">
            مواد ذات صلة
          </h2>
          <ContentGrid items={item.related} />
        </section>
      )}
    </>
  );
}
