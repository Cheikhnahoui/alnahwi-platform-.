/**
 * Server-side sessions. The browser holds a random 256-bit token; the database
 * holds only its SHA-256 hash, so a database leak cannot be replayed as cookies.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import type { PermissionKey } from "./permissions";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_AFTER_MS = 10 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  roleName: string;
  permissions: PermissionKey[];
  mustChangePassword: boolean;
};

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export function can(user: Pick<SessionUser, "permissions">, permission: PermissionKey): boolean {
  return user.permissions.includes(permission);
}

export async function createSession(db: AnyDb, userId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(s.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  });
  return { token, expiresAt };
}

export async function getSessionUser(
  db: AnyDb,
  rawToken: string | undefined | null,
  now = new Date(),
): Promise<SessionUser | null> {
  if (!rawToken || rawToken.length > 200) return null;
  const [row] = await db
    .select({
      sessionId: s.sessions.id,
      lastSeenAt: s.sessions.lastSeenAt,
      id: s.users.id,
      email: s.users.email,
      name: s.users.name,
      roleId: s.users.roleId,
      roleKey: s.roles.key,
      roleName: s.roles.name,
      mustChangePassword: s.users.mustChangePassword,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .innerJoin(s.roles, eq(s.roles.id, s.users.roleId))
    .where(
      and(
        eq(s.sessions.tokenHash, hashToken(rawToken)),
        gt(s.sessions.expiresAt, now),
        eq(s.users.isActive, true),
      ),
    )
    .limit(1);
  if (!row) return null;

  const perms = await db
    .select({ key: s.permissions.key })
    .from(s.rolePermissions)
    .innerJoin(s.permissions, eq(s.permissions.id, s.rolePermissions.permissionId))
    .where(eq(s.rolePermissions.roleId, row.roleId));

  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await db.update(s.sessions).set({ lastSeenAt: now }).where(eq(s.sessions.id, row.sessionId));
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleKey: row.roleKey,
    roleName: row.roleName,
    permissions: perms.map((p) => p.key as PermissionKey),
    mustChangePassword: row.mustChangePassword,
  };
}

export async function revokeSession(db: AnyDb, rawToken: string): Promise<void> {
  await db.delete(s.sessions).where(eq(s.sessions.tokenHash, hashToken(rawToken)));
}

/** Use when an account is disabled, its role changes or its password is reset. */
export async function revokeAllSessions(db: AnyDb, userId: string): Promise<void> {
  await db.delete(s.sessions).where(eq(s.sessions.userId, userId));
}

export async function deleteExpiredSessions(db: AnyDb, now = new Date()): Promise<void> {
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, now));
}