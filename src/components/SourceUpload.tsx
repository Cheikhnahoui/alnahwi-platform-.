"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { registerUploadAction } from "@/app/admin/(panel)/content/upload-actions";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  UPLOAD_TYPES,
  uploadExt,
} from "@/lib/storage/media-types";

type Props = { index: number; initialFileId: string; initialLabel: string };

/**
 * "Upload a file" for one source row. The file goes from the browser straight to storage
 * (with a one-time token from /api/admin/upload); afterwards the row's URL field holds the
 * file's address and is locked, so the row is saved like any other source.
 * The row's own fields are plain uncontrolled inputs, so they are updated through the DOM.
 */
export function SourceUpload({ index, initialFileId, initialLabel }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [fileId, setFileId] = useState(initialFileId);
  const [label, setLabel] = useState(initialLabel);
  const [busy, setBusy] = useState<null | { pct: number; saving: boolean }>(null);
  const [error, setError] = useState<string | null>(null);

  const field = (name: string) =>
    root.current
      ?.closest("li")
      ?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="sources.${index}.${name}"]`) ??
    null;

  // Re-lock the URL of an already uploaded file when the form is shown (edit page, or after an error).
  useEffect(() => {
    const url = field("url");
    if (initialFileId && url instanceof HTMLInputElement) url.readOnly = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    setError(null);
    const ext = uploadExt(file.name);
    if (!ext) {
      setError("هذه الصيغة غير مدعومة. المسموح: mp4 و webm و mp3 و m4a و ogg و wav.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`الملف أكبر من الحد المسموح (${MAX_UPLOAD_MB} ميغابايت).`);
      return;
    }
    setBusy({ pct: 0, saving: false });
    try {
      const blob = await upload(`media/${crypto.randomUUID()}.${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        contentType: UPLOAD_TYPES[ext].mimes[0],
        multipart: file.size > 100 * 1024 * 1024,
        onUploadProgress: ({ percentage }) =>
          setBusy({ pct: Math.round(percentage), saving: false }),
      });
      setBusy({ pct: 100, saving: true });
      const res = await registerUploadAction({ url: blob.url, name: file.name });
      if (!res.ok) throw new Error(res.message);
      const url = field("url");
      const kind = field("kind");
      if (url instanceof HTMLInputElement) {
        url.value = res.url;
        url.readOnly = true;
      }
      if (kind instanceof HTMLSelectElement) kind.value = res.kind;
      setFileId(res.id);
      setLabel(res.label);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "تعذّر رفع الملف. تحقق من الاتصال وحاول مرة أخرى.",
      );
    } finally {
      setBusy(null);
    }
  }

  function remove() {
    const url = field("url");
    if (url instanceof HTMLInputElement) {
      url.value = "";
      url.readOnly = false;
    }
    setFileId("");
    setLabel("");
    setError(null);
  }

  return (
    <div ref={root} className="space-y-2 text-sm sm:col-span-3">
      <input type="hidden" name={`sources.${index}.storedFileId`} value={fileId} />
      <input type="hidden" name={`sources.${index}.fileLabel`} value={label} />
      {fileId ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="text-emerald-900">ملف مرفوع: {label || "ملف"}</span>
          <button
            type="button"
            onClick={remove}
            className="text-red-800 underline underline-offset-4"
          >
            إزالة الملف
          </button>
        </div>
      ) : (
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 font-semibold hover:bg-muted ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? "جارٍ الرفع…" : "رفع ملف من جهازك"}
          <input
            type="file"
            accept=".mp4,.webm,.mp3,.m4a,.ogg,.wav"
            onChange={onPick}
            disabled={Boolean(busy)}
            className="sr-only"
          />
        </label>
      )}
      {busy && (
        <div className="max-w-sm" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-accent transition-all" style={{ width: `${busy.pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {busy.saving ? "جارٍ حفظ الملف…" : `${busy.pct}%`} — لا تغلق الصفحة حتى يكتمل الرفع.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
