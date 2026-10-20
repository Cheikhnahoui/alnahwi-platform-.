/** Plain constants shared by server code and browser components. */
export const PERMISSION_STATUSES = [
  "unknown",
  "pending",
  "granted",
  "restricted",
  "public_domain",
] as const;
export const SOURCE_KINDS = ["video", "audio", "file", "external_link"] as const;
export const MAX_SOURCES = 6;
