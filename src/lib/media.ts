/**
 * Turns a source URL into something the public page can play INSIDE the page.
 *
 * Only a small allow-list is ever embedded (YouTube, Vimeo, and direct media files over
 * HTTPS), so an administrator can never make the site load an arbitrary third-party page
 * in a frame. Anything else returns null and stays a plain link.
 */
export type Player =
  | { type: "iframe"; provider: "youtube" | "vimeo"; src: string }
  | { type: "video"; src: string }
  | { type: "audio"; src: string };

const VIDEO_FILE = /\.(mp4|m4v|webm|ogv)$/i;
const AUDIO_FILE = /\.(mp3|m4a|aac|ogg|oga|opus|wav)$/i;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** "90", "90s", "1m30s", "1h2m3s" -> seconds (0 when it cannot be read). */
function startSeconds(raw: string | null): number {
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Math.min(Number(raw), 86_400);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m) return 0;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return Math.min(total, 86_400);
}

/** The 11-character video id of any YouTube URL shape, or null. */
function youtubeId(u: URL): string | null {
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (YOUTUBE_HOSTS.has(host)) {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  } else return null;
  return id && YT_ID.test(id) ? id : null;
}

function youtube(u: URL): Player | null {
  const id = youtubeId(u);
  if (!id) return null;
  const start = startSeconds(u.searchParams.get("t") ?? u.searchParams.get("start"));
  const qs = start > 0 ? `?start=${start}` : "";
  return {
    type: "iframe",
    provider: "youtube",
    src: `https://www.youtube-nocookie.com/embed/${id}${qs}`,
  };
}

function vimeo(u: URL): Player | null {
  const host = u.hostname.toLowerCase();
  let id: string | null = null;
  let hash: string | null = null;
  if (host === "player.vimeo.com") {
    id = u.pathname.match(/^\/video\/(\d+)\/?$/)?.[1] ?? null;
    hash = u.searchParams.get("h");
  } else if (host === "vimeo.com" || host === "www.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{5,})(?:\/([0-9a-f]{6,}))?\/?$/i);
    id = m?.[1] ?? null;
    hash = m?.[2] ?? u.searchParams.get("h");
  } else return null;
  if (!id) return null;
  const h = hash && /^[0-9a-f]{6,}$/i.test(hash) ? `?h=${hash}` : "";
  return { type: "iframe", provider: "vimeo", src: `https://player.vimeo.com/video/${id}${h}` };
}

/**
 * @param kind the administrator's choice ("file" is for downloads such as PDFs, never played).
 */
export function resolvePlayer(url: string | null | undefined, kind?: string): Player | null {
  if (!url || kind === "file") return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  // HTTPS only: browsers block plain-HTTP media on an HTTPS page, so it would never play.
  if (u.protocol !== "https:") return null;
  const fromHost = youtube(u) ?? vimeo(u);
  if (fromHost) return fromHost;
  if (VIDEO_FILE.test(u.pathname)) return { type: "video", src: u.toString() };
  if (AUDIO_FILE.test(u.pathname)) return { type: "audio", src: u.toString() };
  return null;
}

/**
 * Picture YouTube itself serves for a video (always exists, 480x360). Only an https YouTube URL with a
 * valid 11-character id gives a result, and the host is fixed, so a crafted link cannot point elsewhere.
 */
export function youtubeThumbnail(url: string | null | undefined, kind?: string): string | null {
  if (!url || kind === "file") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const id = youtubeId(u);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}
