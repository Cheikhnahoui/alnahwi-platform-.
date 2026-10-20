import { randomBytes } from "node:crypto";

/** Letters and digits (any language) separated by single hyphens. */
export const SLUG_RE = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

/** Readable slug that keeps Arabic letters (diacritics and tatweel removed). */
export function slugify(input: string): string {
  const s = input
    .normalize("NFKC")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return s || `item-${randomBytes(3).toString("hex")}`;
}

const MAX_SECONDS = 48 * 3600;

/**
 * "H:MM:SS", "MM:SS" or a plain number of minutes.
 * Returns null for empty input and undefined for invalid input.
 */
export function parseDuration(input: string): number | null | undefined {
  const v = input.trim();
  if (!v) return null;
  let seconds: number;
  if (/^\d{1,4}$/.test(v)) seconds = Number(v) * 60;
  else if (/^\d{1,4}:[0-5]\d$/.test(v)) {
    const [m, s] = v.split(":").map(Number);
    seconds = m * 60 + s;
  } else if (/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(v)) {
    const [h, m, s] = v.split(":").map(Number);
    seconds = h * 3600 + m * 60 + s;
  } else return undefined;
  return seconds <= MAX_SECONDS ? seconds : undefined;
}
