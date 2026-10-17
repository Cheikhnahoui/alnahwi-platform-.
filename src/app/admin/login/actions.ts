"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { attemptLogin } from "@/lib/auth/login";
import { getAuthSecret } from "@/lib/auth/secret";
import {
  clearSessionCookie,
  getRequestIpHash,
  SESSION_COOKIE,
  setSessionCookie,
} from "@/lib/auth/guard";
import { revokeSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

export type LoginState = { error?: string };

const INVALID = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
const schema = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) });

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: INVALID };

  let result;
  try {
    result = await attemptLogin(getDb(), {
      ...parsed.data,
      ipHash: await getRequestIpHash(),
      secret: getAuthSecret(),
    });
  } catch (err) {
    console.error("Login failed unexpectedly:", err instanceof Error ? err.message : err);
    return { error: "تعذّر إتمام العملية الآن. حاول مرة أخرى بعد قليل." };
  }
  if (!result.ok) {
    return {
      error:
        result.reason === "rate_limited" ? "محاولات كثيرة. حاول مرة أخرى بعد 15 دقيقة." : INVALID,
    };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect("/admin"); // outside try/catch: redirect() works by throwing
}

export async function logoutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(getDb(), token).catch(() => undefined);
  await clearSessionCookie();
  redirect("/admin/login");
}