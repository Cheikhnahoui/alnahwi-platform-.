import { safeHttpUrl } from "@/lib/format";
import { parseDuration, slugify, SLUG_RE } from "./slug";

import { MAX_SOURCES, PERMISSION_STATUSES, SOURCE_KINDS } from "./content-constants";

export { MAX_SOURCES, PERMISSION_STATUSES, SOURCE_KINDS };

export type SourceInput = {
  kind: (typeof SOURCE_KINDS)[number];
  url: string;
  sourceName: string | null;
  isPrimary: boolean;
  isDownloadable: boolean;
};

export type ContentData = {
  title: string;
  slug?: string;
  contentTypeId: string;
  summary: string | null;
  description: string | null;
  speakerName: string | null;
  recordedAt: Date | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  copyrightNotice: string | null;
  permissionStatus: (typeof PERMISSION_STATUSES)[number];
  reuseRestrictions: string | null;
  isFeatured: boolean;
  categoryIds: string[];
  tags: string[];
  relatedSlugs: string[];
  sources: SourceInput[];
};

export type ParseResult =
  { ok: true; data: ContentData } | { ok: false; errors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates the admin form on the SERVER. Never trust the browser's own checks. */
export function parseContentForm(fd: FormData): ParseResult {
  const errors: Record<string, string> = {};
  const str = (n: string) => String(fd.get(n) ?? "").trim();
  const opt = (n: string, max: number, label: string) => {
    const v = str(n);
    if (v.length > max) errors[n] = `${label} يجب ألا يزيد على ${max} حرف.`;
    return v || null;
  };

  const title = str("title");
  if (!title) errors.title = "العنوان مطلوب.";
  else if (title.length > 200) errors.title = "العنوان يجب ألا يزيد على 200 حرف.";

  const slugRaw = str("slug");
  if (slugRaw && (slugRaw.length > 120 || !SLUG_RE.test(slugRaw))) {
    errors.slug = "الرابط يقبل حروفًا وأرقامًا وشرطات فقط، دون مسافات.";
  }

  const contentTypeId = str("contentTypeId");
  if (!UUID.test(contentTypeId)) errors.contentTypeId = "اختر نوع المادة.";

  const summary = opt("summary", 500, "الملخص");
  const description = opt("description", 20000, "الوصف");
  const speakerName = opt("speakerName", 200, "اسم المتحدث");
  const copyrightNotice = opt("copyrightNotice", 1000, "إشعار الحقوق");
  const reuseRestrictions = opt("reuseRestrictions", 1000, "قيود إعادة الاستخدام");

  let recordedAt: Date | null = null;
  const rec = str("recordedAt");
  if (rec) {
    const d = new Date(`${rec}T00:00:00Z`);
    if (!DATE.test(rec) || Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1900) {
      errors.recordedAt = "تاريخ الإلقاء غير صالح.";
    } else recordedAt = d;
  }

  const dur = parseDuration(str("duration"));
  if (dur === undefined) errors.duration = "المدة غير صالحة. مثال: 1:25:30 أو 45:10 أو 90 (دقائق).";

  let thumbnailUrl: string | null = null;
  const thumb = str("thumbnailUrl");
  if (thumb) {
    thumbnailUrl = safeHttpUrl(thumb);
    if (!thumbnailUrl) errors.thumbnailUrl = "رابط الصورة يجب أن يبدأ بـ https:// أو http://.";
  }

  const ps = str("permissionStatus") || "unknown";
  if (!(PERMISSION_STATUSES as readonly string[]).includes(ps)) {
    errors.permissionStatus = "حالة الإذن غير صالحة.";
  }

  const categoryIds = [...new Set(fd.getAll("categoryIds").map(String))];
  if (categoryIds.length > 20) errors.categoryIds = "الحد الأقصى 20 تصنيفًا.";
  else if (categoryIds.some((c) => !UUID.test(c))) errors.categoryIds = "تصنيف غير صالح.";

  const tagMap = new Map<string, string>();
  for (const t of str("tags").split(/[,،\n]+/)) {
    const name = t.trim();
    if (!name) continue;
    if (name.length > 50) errors.tags = "الوسم الواحد لا يزيد على 50 حرفًا.";
    tagMap.set(slugify(name), name);
  }
  if (tagMap.size > 30) errors.tags = "الحد الأقصى 30 وسمًا.";

  const relatedSlugs = [
    ...new Set(
      str("related")
        .split(/[\s,،]+/)
        .filter(Boolean),
    ),
  ];
  if (relatedSlugs.length > 20) errors.related = "الحد الأقصى 20 مادة ذات صلة.";
  else if (relatedSlugs.some((r) => !SLUG_RE.test(r))) errors.related = "رابط مادة غير صالح.";

  const primaryIdx = str("primarySource");
  const sources: SourceInput[] = [];
  for (let i = 0; i < MAX_SOURCES; i++) {
    const url = str(`sources.${i}.url`);
    if (!url) continue;
    const kind = str(`sources.${i}.kind`) || "external_link";
    if (!(SOURCE_KINDS as readonly string[]).includes(kind))
      errors[`sources.${i}.kind`] = "نوع المصدر غير صالح.";
    const safe = safeHttpUrl(url);
    if (!safe) errors[`sources.${i}.url`] = "رابط المصدر يجب أن يبدأ بـ https:// أو http://.";
    const sourceName = str(`sources.${i}.sourceName`);
    if (sourceName.length > 200) errors[`sources.${i}.sourceName`] = "اسم المصدر طويل جدًا.";
    sources.push({
      kind: kind as SourceInput["kind"],
      url: safe ?? url,
      sourceName: sourceName || null,
      isPrimary: primaryIdx === String(i),
      isDownloadable: fd.get(`sources.${i}.isDownloadable`) === "on",
    });
  }
  if (sources.length && !sources.some((s) => s.isPrimary)) sources[0].isPrimary = true;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title,
      slug: slugRaw || undefined,
      contentTypeId,
      summary,
      description,
      speakerName,
      recordedAt,
      durationSeconds: dur ?? null,
      thumbnailUrl,
      copyrightNotice,
      permissionStatus: ps as ContentData["permissionStatus"],
      reuseRestrictions,
      isFeatured: fd.get("isFeatured") === "on",
      categoryIds,
      tags: [...tagMap.values()],
      relatedSlugs,
      sources,
    },
  };
}
