import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/admin/workflow";
import { UploadError, uploadTokenOptions } from "@/lib/storage/upload-policy";

/**
 * Hands the browser a one-time token so it can upload a video/audio file straight to storage
 * (the file never passes through this server, which is what allows large files on Vercel).
 * Only signed-in editors may get a token, and only for the allowed file types and size.
 */
export async function POST(request: Request) {
  // Same-origin only: a form on another site must not be able to request upload tokens.
  const origin = request.headers.get("origin");
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === request.headers.get("host");
    } catch {}
    if (!sameHost) return NextResponse.json({ error: "طلب غير مسموح." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول." }, { status: 401 });
  if (!hasPermission(user, "content.create") && !hasPermission(user, "content.edit")) {
    return NextResponse.json({ error: "لا تملك صلاحية رفع الملفات." }, { status: 403 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => uploadTokenOptions(pathname),
    });
    return NextResponse.json(json);
  } catch (e) {
    const message = e instanceof UploadError ? e.message : "تعذّر بدء الرفع.";
    if (!(e instanceof UploadError)) console.error("Upload token failed:", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
