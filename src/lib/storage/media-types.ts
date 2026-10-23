/**
 * What may be uploaded as a source, shared by the browser (early feedback) and the server
 * (the real check). Only formats that browsers can play natively are allowed.
 */
export const MAX_UPLOAD_MB = 500; // Vercel Blob serves files up to 512 MB through its cache
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const UPLOAD_TYPES: Record<string, { mimes: string[]; kind: "video" | "audio" }> = {
  mp4: { mimes: ["video/mp4"], kind: "video" },
  webm: { mimes: ["video/webm"], kind: "video" },
  mp3: { mimes: ["audio/mpeg"], kind: "audio" },
  m4a: { mimes: ["audio/mp4", "audio/x-m4a", "audio/m4a"], kind: "audio" },
  ogg: { mimes: ["audio/ogg", "video/ogg", "application/ogg"], kind: "audio" },
  wav: { mimes: ["audio/wav", "audio/x-wav", "audio/wave"], kind: "audio" },
};

/** Lower-case extension if (and only if) it is an allowed upload type. */
export function uploadExt(nameOrPath: string): string | null {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(nameOrPath);
  const ext = m?.[1].toLowerCase();
  return ext && ext in UPLOAD_TYPES ? ext : null;
}

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} غيغابايت`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} ميغابايت`;
  return `${Math.max(1, Math.round(n / 1024))} كيلوبايت`;
}

/** "lesson.mp4 (195 كيلوبايت)": how an uploaded file is described in the admin form. */
export function fileLabel(name: string, sizeBytes: number): string {
  return `${name} (${formatBytes(sizeBytes)})`;
}

/** Only files in OUR public Vercel Blob store are ever registered (never an arbitrary URL). */
export function isBlobUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}
