"use server";

import { getCurrentUser } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { hasPermission } from "@/lib/admin/workflow";
import { registerStoredFile, type RegisteredFile } from "@/lib/storage/files";
import { vercelBlobStore } from "@/lib/storage/store";
import { UploadError } from "@/lib/storage/upload-policy";

export type RegisterUploadResult = ({ ok: true } & RegisteredFile) | { ok: false; message: string };

/** Step 2 of an upload: record the file the browser just uploaded (after verifying it). */
export async function registerUploadAction(input: {
  url: string;
  name: string;
}): Promise<RegisterUploadResult> {
  const user = await getCurrentUser();
  if (!user || (!hasPermission(user, "content.create") && !hasPermission(user, "content.edit"))) {
    return { ok: false, message: "لا تملك صلاحية رفع الملفات." };
  }
  try {
    const file = await registerStoredFile(getDb(), vercelBlobStore, user.id, {
      url: String(input.url ?? ""),
      name: String(input.name ?? ""),
    });
    return { ok: true, ...file };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, message: e.message };
    console.error("Register upload failed:", e instanceof Error ? e.message : e);
    return { ok: false, message: "تعذّر حفظ الملف المرفوع. حاول مرة أخرى." };
  }
}
