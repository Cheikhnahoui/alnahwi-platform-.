/**
 * Request-level authentication helpers for the admin area (cookies, redirects).
 * Every protected page and every Server Action must call requireUser() or
 * requirePermission() itself: layouts do not re-run on client navigation, so a
 * layout check alone is NOT a security boundary.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import type { PermissionKey } from "./permissions";
import { getAuthSecret, keyedHash } from "./secret";
import { can, getSessionUser, SESSION_TTL_MS, type SessionUser } from "./session";

const isProd = process.env.NODE_ENV === "production";
/** "__Host-" forces Secure, Path=/ and no Domain: the cookie cannot be set by sibling subdomains. */
export const SESSION_COOKIE = isProd ? "__Host-nahwi_session" : "nahwi_session";

/** Deduplicated per request, so layout + page + actions share one database lookup. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Session lookups (cookie + clock + database) must only ever run for a real request,
  // never in a prerender or prefetch pass.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getSessionUser(getDb(), token) : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requirePermission(permission: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/admin/forbidden");
  return user;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Keyed hash of the client IP (for rate limiting only; the raw IP is never stored). */
export async function getRequestIpHash(): Promise<string> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return keyedHash(raw, getAuthSecret());
}