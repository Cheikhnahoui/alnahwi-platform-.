import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/admin/audit";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { dummyHash, verifyPassword } from "./password";
import { keyedHash } from "./secret";
import { createSession, type SessionUser } from "./session";

export const MAX_FAILURES_PER_ACCOUNT = 5;
export const MAX_FAILURES_PER_IP = 20;
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; userId: string }
  | { ok: false; reason: "invalid" | "rate_limited" };

/**
 * Checks credentials with rate limiting. All failure causes (unknown email, wrong
 * password, disabled account, no password set) return the same "invalid" result and
 * cost the same time, so the form cannot be used to discover which emails exist.
 */
export async function attemptLogin(
  db: AnyDb,
  input: { email: string; password: string; ipHash: string; secret: string; now?: Date },
): Promise<LoginResult> {
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const identifierHash = keyedHash(email, input.secret);
  const since = new Date(now.getTime() - ATTEMPT_WINDOW_MS);

  const failures = async (
    col: typeof s.authAttempts.identifierHash | typeof s.authAttempts.ipHash,
    value: string,
  ) => {
    const [r] = await db
      .select({ n: count() })
      .from(s.authAttempts)
      .where(
        and(eq(col, value), eq(s.authAttempts.success, false), gt(s.authAttempts.createdAt, since)),
      );
    return Number(r.n);
  };
  if (
    (await failures(s.authAttempts.identifierHash, identifierHash)) >= MAX_FAILURES_PER_ACCOUNT ||
    (await failures(s.authAttempts.ipHash, input.ipHash)) >= MAX_FAILURES_PER_IP
  ) {
    return { ok: false, reason: "rate_limited" };
  }

  const [user] = await db
    .select()
    .from(s.users)
    .where(sql`lower(${s.users.email}) = ${email}`)
    .limit(1);

  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !user.isActive || !user.passwordHash || !valid) {
    await db
      .insert(s.authAttempts)
      .values({ identifierHash, ipHash: input.ipHash, success: false, createdAt: now });
    return { ok: false, reason: "invalid" };
  }

  // Success: forget this account's failures, prune old rows, open a session.
  await db
    .delete(s.authAttempts)
    .where(
      and(eq(s.authAttempts.identifierHash, identifierHash), eq(s.authAttempts.success, false)),
    );
  await db
    .delete(s.authAttempts)
    .where(lt(s.authAttempts.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  await db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, user.id));
  const session = await createSession(db, user.id, now);
  await writeAudit(db, {
    actorId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });
  return { ok: true, token: session.token, expiresAt: session.expiresAt, userId: user.id };
}

export type { SessionUser };