import { formatDuration } from "@/lib/format";
import { MAX_SOURCES } from "./content-constants";
import type { AdminContentFull } from "./content";

export type FormValues = Record<string, string | string[]>;

/** Empty form for "new material". */
export const EMPTY_FORM: FormValues = {
  title: "",
  slug: "",
  contentTypeId: "",
  summary: "",
  description: "",
  speakerName: "",
  recordedAt: "",
  duration: "",
  thumbnailUrl: "",
  copyrightNotice: "",
  permissionStatus: "unknown",
  reuseRestrictions: "",
  isFeatured: "",
  categoryIds: [],
  tags: "",
  related: "",
  primarySource: "0",
};

/** Turns a saved item into the field values the edit form shows. */
export function toFormValues(full: AdminContentFull): FormValues {
  const { item } = full;
  const v: FormValues = {
    title: item.title,
    slug: item.slug,
    contentTypeId: item.contentTypeId,
    summary: item.summary ?? "",
    description: item.description ?? "",
    speakerName: item.speakerName ?? "",
    recordedAt: item.recordedAt ? item.recordedAt.toISOString().slice(0, 10) : "",
    duration: formatDuration(item.durationSeconds) ?? "",
    thumbnailUrl: item.thumbnailUrl ?? "",
    copyrightNotice: item.copyrightNotice ?? "",
    permissionStatus: item.permissionStatus,
    reuseRestrictions: item.reuseRestrictions ?? "",
    isFeatured: item.isFeatured ? "on" : "",
    categoryIds: full.categoryIds,
    tags: full.tags.join("، "),
    related: full.relatedSlugs.join(", "),
    primarySource: String(
      Math.max(
        0,
        full.sources.findIndex((x) => x.isPrimary),
      ),
    ),
  };
  full.sources.slice(0, MAX_SOURCES).forEach((src, i) => {
    v[`sources.${i}.kind`] = src.kind;
    v[`sources.${i}.url`] = src.url;
    v[`sources.${i}.sourceName`] = src.sourceName ?? "";
    v[`sources.${i}.isDownloadable`] = src.isDownloadable ? "on" : "";
  });
  return v;
}

/** Plain object copy of submitted FormData, used to refill the form after an error. */
export function valuesFromFormData(fd: FormData): FormValues {
  const out: FormValues = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue; // framework fields
    const all = fd.getAll(key).filter((x): x is string => typeof x === "string");
    out[key] = key === "categoryIds" ? all : (all[0] ?? "");
  }
  if (!("categoryIds" in out)) out.categoryIds = [];
  return out;
}
