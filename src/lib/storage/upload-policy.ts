import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "./media-types";

export class UploadError extends Error {}

/**
 * Rules for the one-time upload token. The browser chooses the path, so it is validated here:
 * a fixed folder, a plain file name, and an allowed extension. The token then only accepts the
 * matching content type and size, which Vercel enforces itself.
 */
export function uploadTokenOptions(pathname: string) {
  const m = /^media\/[A-Za-z0-9._-]{1,120}\.([A-Za-z0-9]{2,5})$/.exec(pathname);
  const spec = m ? UPLOAD_TYPES[m[1].toLowerCase()] : undefined;
  if (!spec || pathname.includes("..")) {
    throw new UploadError("نوع الملف غير مسموح. المسموح: mp4 و webm و mp3 و m4a و ogg و wav.");
  }
  return {
    allowedContentTypes: spec.mimes,
    maximumSizeInBytes: MAX_UPLOAD_BYTES,
    addRandomSuffix: true,
    allowOverwrite: false,
  };
}
