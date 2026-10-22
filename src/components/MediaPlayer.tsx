import type { Player } from "@/lib/media";

/**
 * Plays one source inside the page. Server component: native <video>/<audio> and
 * iframes need no client JavaScript.
 */
export function MediaPlayer({
  player,
  title,
  poster,
}: {
  player: Player;
  title: string;
  poster?: string | null;
}) {
  if (player.type === "iframe") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-black">
        <iframe
          src={player.src}
          title={title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
      </div>
    );
  }
  if (player.type === "video") {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        className="aspect-video w-full rounded-md border border-border bg-black"
      >
        <source src={player.src} />
        متصفحك لا يدعم تشغيل الفيديو. يمكنك فتح الملف من قسم «المصادر».
      </video>
    );
  }
  return (
    <audio controls preload="metadata" className="w-full">
      <source src={player.src} />
      متصفحك لا يدعم تشغيل الصوت. يمكنك فتح الملف من قسم «المصادر».
    </audio>
  );
}
