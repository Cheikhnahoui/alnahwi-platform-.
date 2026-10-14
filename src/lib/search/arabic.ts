/**
 * Arabic text normalisation for search. Used to build `search_text` and to
 * normalise queries. The original stored text is never modified.
 */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXT_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;

export function normalizeArabic(input: string): string {
  return input
    .normalize("NFKC")
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u06A9]/g, "ك") // Persian kaf
    .replace(/[\u06CC]/g, "ي") // Persian yeh
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchText(...parts: Array<string | null | undefined>): string {
  return normalizeArabic(parts.filter(Boolean).join(" "));
}
