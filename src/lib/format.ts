// Latin digits (nu-latn) are used for readability across Arabic-speaking regions.
const dateFmt = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "long", timeZone: "UTC" });

export function formatDate(d: Date | null | undefined): string | null {
  return d ? dateFmt.format(d) : null;
}

/** 3725 -> "1:02:05", 125 -> "2:05". */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Returns the URL only if it is a well-formed http(s) URL; blocks javascript:, data:, etc. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Route params may arrive percent-encoded depending on the runtime. */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Splits plain text into paragraphs (rendered as text nodes, so always XSS-safe). */
export function toParagraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const PERMISSION_LABELS: Record<string, string> = {
  unknown: "غير محددة",
  pending: "قيد الاستيثاق",
  granted: "مأذون بها",
  restricted: "مقيّدة",
  public_domain: "مباحة للجميع",
};

export const SOURCE_KIND_LABELS: Record<string, string> = {
  video: "فيديو",
  audio: "صوت",
  file: "ملف",
  external_link: "رابط",
};
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Numeric date used on material cards: 2024-05-12 (UTC, like formatDate). */
export function formatDateNumeric(d: Date | null | undefined): string | null {
  return d ? isoDate(d) : null;
}

/** 2700 -> "45 دقيقة", 4800 -> "ساعة 20 دقيقة", 3600 -> "ساعة". Under a minute -> null. */
export function formatDurationWords(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 60) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const hours = h === 0 ? "" : h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${h} ساعات`;
  const mins = m === 0 ? "" : `${m} دقيقة`;
  return [hours, mins].filter(Boolean).join(" ");
}
