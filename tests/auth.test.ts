import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "./helpers/db";
import { seedReferenceData } from "@/lib/db/seed-reference";
import { seedSampleData } from "@/lib/db/seed-sample";
import * as s from "@/lib/db/schema";
import { dummyHash, hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_TTL_MS,
  can,
  createSession,
  deleteExpiredSessions,
  getSessionUser,
  hashToken,
  revokeAllSessions,
  revokeSession,
} from "@/lib/auth/session";
import {
  ATTEMPT_WINDOW_MS,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_IP,
  attemptLogin,
} from "@/lib/auth/login";
import {
  AuthError,
  bootstrapSuperAdmin,
  countActiveSuperAdmins,
  createAdminUser,
} from "@/lib/auth/users";
import { getAdminStats } from "@/lib/admin/stats";
import { keyedHash } from "@/lib/auth/secret";

const SECRET = "test-secret-test-secret-test-secret-123";
const GOOD = "correct horse battery staple";
let ctx: Awaited<ReturnType<typeof createTestDb>>;
let ipCounter = 0;
const ip = () => `ip-${++ipCounter}`;
const login = (email: string, password: string, ipHash = ip(), now?: Date) =>
  attemptLogin(ctx.db, { email, password, ipHash, secret: SECRET, now });

beforeAll(async () => {
  ctx = await createTestDb();
  await seedReferenceData(ctx.db);
});
afterAll(async () => ctx.client.close());

describe("password hashing", () => {
  it("hashes with scrypt, a random salt, and verifies", async () => {
    const a = await hashPassword(GOOD);
    const b = await hashPassword(GOOD);
    expect(a).toMatch(/^scrypt\$32768\$8\$3\$/);
    expect(a).not.toBe(b); // different salts
    expect(a).not.toContain(GOOD);
    expect(await verifyPassword(GOOD, a)).toBe(true);
    expect(await verifyPassword(GOOD + "x", a)).toBe(false);
    expect(await verifyPassword("", a)).toBe(false);
  });
  it("treats equivalent unicode forms as the same password", async () => {
    const h = await hashPassword("كلمة-سر-طويلة-ومعقدة\u00e9"); // é precomposed
    expect(await verifyPassword("كلمة-سر-طويلة-ومعقدة\u0065\u0301", h)).toBe(true); // e + combining accent
  });
  it("never throws on malformed or tampered hashes", async () => {
    for (const bad of [
      "",
      "x",
      "scrypt$1$2$3",
      "scrypt$99999999$8$3$AAAA$AAAA",
      "bcrypt$a$b$c$d$e",
      "scrypt$32768$8$3$$",
      "scrypt$abc$8$3$AAAA$AAAA",
    ]) {
      expect(await verifyPassword(GOOD, bad)).toBe(false);
    }
  });
  it("provides a valid dummy hash for unknown accounts", async () => {
    expect(await verifyPassword("anything", await dummyHash())).toBe(false);
  });
  it("enforces the password policy with Arabic messages", () => {
    expect(validatePassword("short")).toHaveLength(1);
    expect(validatePassword("a".repeat(129))[0]).toMatch(/128/);
    expect(validatePassword("aaaaaaaaaaaaaaaa")).toHaveLength(1);
    expect(validatePassword("password1234")).toHaveLength(1);
    expect(validatePassword("sheikhsecret-2026", { email: "sheikh@example.org" })).toHaveLength(1); // contains local part
    expect(validatePassword(GOOD, { email: "x@example.org" })).toEqual([]);
    expect(validatePassword("عبارة-مرور-عربية-طويلة")).toEqual([]);
  });
});

describe("administrator creation", () => {
  it("creates a super admin with a hashed password and an audit entry", async () => {
    const u = await bootstrapSuperAdmin(ctx.db, {
      email: "Admin@Example.org",
      name: "مسؤول",
      password: GOOD,
    });
    const [row] = await ctx.db.select().from(s.users).where(eq(s.users.id, u.id));
    expect(row.email).toBe("admin@example.org"); // normalised
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain(GOOD);
    const log = await ctx.db
      .select()
      .from(s.auditLogs)
      .where(eq(s.auditLogs.action, "user.create"));
    expect(log).toHaveLength(1);
    expect(JSON.stringify(log[0].metadata)).not.toContain(GOOD);
  });
  it("refuses a second super admin unless explicitly allowed", async () => {
    expect(await countActiveSuperAdmins(ctx.db)).toBe(1);
    await expect(
      bootstrapSuperAdmin(ctx.db, { email: "second@example.org", name: "ثانٍ", password: GOOD }),
    ).rejects.toThrow(AuthError);
    await expect(
      bootstrapSuperAdmin(ctx.db, {
        email: "second@example.org",
        name: "ثانٍ",
        password: GOOD,
        allowAdditional: true,
      }),
    ).resolves.toBeDefined();
  });
  it("rejects weak passwords, bad emails, short names and duplicates", async () => {
    const base = { name: "اسم", roleKey: "editor" as const };
    await expect(
      createAdminUser(ctx.db, { ...base, email: "a@example.org", password: "short" }),
    ).rejects.toThrow(/الشروط/);
    await expect(
      createAdminUser(ctx.db, { ...base, email: "not-an-email", password: GOOD }),
    ).rejects.toThrow(/البريد/);
    await expect(
      createAdminUser(ctx.db, { ...base, name: "x", email: "b@example.org", password: GOOD }),
    ).rejects.toThrow(/الاسم/);
    await expect(
      createAdminUser(ctx.db, { ...base, email: "ADMIN@example.org", password: GOOD }),
    ).rejects.toThrow(/مسبقًا/);
  });
});


describe("sign-in", () => {
  beforeAll(async () => {
    await createAdminUser(ctx.db, {
      email: "editor@example.org",
      name: "محرر",
      password: GOOD,
      roleKey: "editor",
    });
    await createAdminUser(ctx.db, {
      email: "off@example.org",
      name: "معطل",
      password: GOOD,
      roleKey: "editor",
    });
    await ctx.db
      .update(s.users)
      .set({ isActive: false })
      .where(eq(s.users.email, "off@example.org"));
  });

  it("opens a session on valid credentials and loads role permissions", async () => {
    const r = await login("EDITOR@example.org", GOOD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const user = await getSessionUser(ctx.db, r.token);
    expect(user?.email).toBe("editor@example.org");
    expect(user?.roleKey).toBe("editor");
    expect(user?.permissions.sort()).toEqual([
      "content.create",
      "content.edit",
      "content.view_drafts",
    ]);
    expect(can(user!, "content.create")).toBe(true);
    expect(can(user!, "users.manage")).toBe(false);
    const [row] = await ctx.db
      .select()
      .from(s.users)
      .where(eq(s.users.email, "editor@example.org"));
    expect(row.lastLoginAt).not.toBeNull();
  });
  it("gives super admin every permission", async () => {
    const r = await login("admin@example.org", GOOD);
    if (!r.ok) throw new Error("login failed");
    expect((await getSessionUser(ctx.db, r.token))?.permissions).toHaveLength(14);
  });
  it("stores only a hash of the session token", async () => {
    const r = await login("editor@example.org", GOOD);
    if (!r.ok) throw new Error("login failed");
    const rows = await ctx.db.select().from(s.sessions);
    expect(rows.some((x) => x.tokenHash === r.token)).toBe(false);
    expect(rows.some((x) => x.tokenHash === hashToken(r.token))).toBe(true);
  });
  it("returns the same generic failure for every kind of bad credential", async () => {
    const results = [
      await login("editor@example.org", "wrong password here"),
      await login("nobody@example.org", GOOD),
      await login("off@example.org", GOOD), // disabled account, correct password
    ];
    for (const r of results) expect(r).toEqual({ ok: false, reason: "invalid" });
  });
  it("does not let an account without a password sign in", async () => {
    const [role] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, "reviewer"));
    await ctx.db
      .insert(s.users)
      .values({ email: "nopass@example.org", name: "ب", roleId: role.id });
    expect(await login("nopass@example.org", "")).toEqual({ ok: false, reason: "invalid" });
    expect(await login("nopass@example.org", GOOD)).toEqual({ ok: false, reason: "invalid" });
  });
  it("locks an account after repeated failures, even for the right password", async () => {
    const email = "editor@example.org";
    const t0 = new Date("2030-01-01T10:00:00Z");
    // use a different IP each time so only the per-account limit can trigger
    for (let i = 0; i < MAX_FAILURES_PER_ACCOUNT; i++) {
      expect(await login(email, "bad-password-" + i, ip(), t0)).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
    expect(await login(email, GOOD, ip(), t0)).toEqual({ ok: false, reason: "rate_limited" });
    // the window passes: allowed again, and success clears the counter
    const later = new Date(t0.getTime() + ATTEMPT_WINDOW_MS + 1000);
    expect((await login(email, GOOD, ip(), later)).ok).toBe(true);
    expect((await login(email, "bad-again", ip(), later)).ok).toBe(false);
    expect((await login(email, GOOD, ip(), later)).ok).toBe(true);
  });
  it("limits failures per IP across different accounts", async () => {
    const sameIp = "ip-attacker";
    const t0 = new Date("2031-01-01T10:00:00Z");
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) {
      await login(`ghost${i}@example.org`, "bad-password", sameIp, t0);
    }
    expect(await login("editor@example.org", GOOD, sameIp, t0)).toEqual({
      ok: false,
      reason: "rate_limited",
    });
    expect((await login("editor@example.org", GOOD, ip(), t0)).ok).toBe(true); // another IP is fine
  });
  it("keeps no raw emails or IPs in the attempts table", async () => {
    // The request layer hashes the client IP with the secret before calling attemptLogin.
    await login("someone@example.org", "bad-password", keyedHash("203.0.113.9", SECRET));
    const rows = await ctx.db.select().from(s.authAttempts);
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain("someone@example.org");
    expect(dump).not.toContain("203.0.113.9");
    expect(rows.some((r) => r.identifierHash === keyedHash("someone@example.org", SECRET))).toBe(
      true,
    );
  });
});

describe("sessions", () => {
  async function newSession(email = "editor@example.org", now = new Date()) {
    const [u] = await ctx.db.select().from(s.users).where(eq(s.users.email, email));
    return { userId: u.id, ...(await createSession(ctx.db, u.id, now)) };
  }
  it("rejects missing, garbage and oversized tokens", async () => {
    expect(await getSessionUser(ctx.db, undefined)).toBeNull();
    expect(await getSessionUser(ctx.db, "")).toBeNull();
    expect(await getSessionUser(ctx.db, "not-a-real-token")).toBeNull();
    expect(await getSessionUser(ctx.db, "x".repeat(500))).toBeNull();
  });
  it("expires after the TTL", async () => {
    const start = new Date("2040-01-01T00:00:00Z");
    const { token } = await newSession("editor@example.org", start);
    expect(
      await getSessionUser(ctx.db, token, new Date(start.getTime() + SESSION_TTL_MS - 1000)),
    ).not.toBeNull();
    expect(
      await getSessionUser(ctx.db, token, new Date(start.getTime() + SESSION_TTL_MS + 1000)),
    ).toBeNull();
  });
  it("can be revoked individually or for a whole user", async () => {
    const a = await newSession();
    const b = await newSession();
    await revokeSession(ctx.db, a.token);
    expect(await getSessionUser(ctx.db, a.token)).toBeNull();
    expect(await getSessionUser(ctx.db, b.token)).not.toBeNull();
    await revokeAllSessions(ctx.db, b.userId);
    expect(await getSessionUser(ctx.db, b.token)).toBeNull();
  });
  it("stops working immediately when the account is disabled or deleted", async () => {
    const { token, userId } = await newSession("editor@example.org");
    await ctx.db.update(s.users).set({ isActive: false }).where(eq(s.users.id, userId));
    expect(await getSessionUser(ctx.db, token)).toBeNull();
    await ctx.db.update(s.users).set({ isActive: true }).where(eq(s.users.id, userId));
    expect(await getSessionUser(ctx.db, token)).not.toBeNull();
    await ctx.db.delete(s.users).where(eq(s.users.id, userId));
    expect(await getSessionUser(ctx.db, token)).toBeNull();
    expect(
      await ctx.db.select().from(s.sessions).where(eq(s.sessions.userId, userId)),
    ).toHaveLength(0); // cascade
  });
  it("reflects a role change on the next request", async () => {
    await createAdminUser(ctx.db, {
      email: "promo@example.org",
      name: "ترقية",
      password: GOOD,
      roleKey: "reviewer",
    });
    const { token, userId } = await newSession("promo@example.org");
    expect((await getSessionUser(ctx.db, token))?.permissions).toEqual(
      expect.arrayContaining(["content.review"]),
    );
    const [editor] = await ctx.db.select().from(s.roles).where(eq(s.roles.key, "editor"));
    await ctx.db.update(s.users).set({ roleId: editor.id }).where(eq(s.users.id, userId));
    const after = await getSessionUser(ctx.db, token);
    expect(after?.roleKey).toBe("editor");
    expect(after?.permissions).not.toContain("content.review");
  });
  it("prunes expired sessions", async () => {
    await newSession("admin@example.org", new Date("2000-01-01T00:00:00Z"));
    await deleteExpiredSessions(ctx.db);
    const all = await ctx.db.select().from(s.sessions);
    expect(all.every((x) => x.expiresAt > new Date())).toBe(true);
  });
});

describe("admin dashboard statistics", () => {
  it("counts real rows only", async () => {
    const empty = await getAdminStats(ctx.db);
    expect(empty.published).toBe(0);
    expect(empty.categories).toBe(0);
    expect(empty.recent.length).toBeGreaterThan(0); // the user.create / auth.login entries above
    await seedSampleData(ctx.db);
    const st = await getAdminStats(ctx.db);
    expect(st.published).toBe(26);
    expect(st.drafts).toBe(1);
    expect(st.inReview).toBe(1);
    expect(st.categories).toBe(3);
    expect(st.tags).toBe(2);
    expect(st.adminUsers).toBeGreaterThanOrEqual(2);
    expect(st.recent.length).toBeLessThanOrEqual(10);
  });
});