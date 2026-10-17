import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/admin/audit";
import * as s from "@/lib/db/schema";
import type { AnyDb } from "@/lib/db/types";
import { hashPassword, validatePassword } from "./password";
import type { RoleKey } from "./permissions";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export async function countActiveSuperAdmins(db: AnyDb): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(s.users)
    .innerJoin(s.roles, eq(s.roles.id, s.users.roleId))
    .where(and(eq(s.roles.key, "super_admin"), eq(s.users.isActive, true)));
  return Number(r.n);
}

/** Creates an administrator with a hashed password. Used by the setup script and, later, the admin UI. */
export async function createAdminUser(
  db: AnyDb,
  input: {
    email: string;
    name: string;
    password: string;
    roleKey: RoleKey;
    actorId?: string | null;
  },
) {
  const parsedEmail = emailSchema.safeParse(input.email);
  if (!parsedEmail.success) throw new AuthError("البريد الإلكتروني غير صالح.");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100)
    throw new AuthError("الاسم يجب أن يكون بين 2 و100 حرف.");
  const pwErrors = validatePassword(input.password, { email: parsedEmail.data, name });
  if (pwErrors.length) throw new AuthError("كلمة المرور لا تستوفي الشروط.", pwErrors);

  const [role] = await db.select().from(s.roles).where(eq(s.roles.key, input.roleKey)).limit(1);
  if (!role) throw new AuthError("الدور غير موجود. نفّذ db:seed أولًا.");
  const [existing] = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(sql`lower(${s.users.email}) = ${parsedEmail.data}`)
    .limit(1);
  if (existing) throw new AuthError("يوجد حساب بهذا البريد الإلكتروني مسبقًا.");

  const [user] = await db
    .insert(s.users)
    .values({
      email: parsedEmail.data,
      name,
      roleId: role.id,
      passwordHash: await hashPassword(input.password),
    })
    .returning({ id: s.users.id, email: s.users.email });
  await writeAudit(db, {
    actorId: input.actorId ?? null,
    action: "user.create",
    entityType: "user",
    entityId: user.id,
    metadata: { role: input.roleKey },
  });
  return user;
}

/** First-administrator setup: refuses when a super admin already exists unless explicitly allowed. */
export async function bootstrapSuperAdmin(
  db: AnyDb,
  input: { email: string; name: string; password: string; allowAdditional?: boolean },
) {
  if (!input.allowAdditional && (await countActiveSuperAdmins(db)) > 0) {
    throw new AuthError("يوجد مسؤول رئيسي مفعّل بالفعل. استخدم لوحة التحكم لإضافة حسابات أخرى.");
  }
  return createAdminUser(db, { ...input, roleKey: "super_admin" });
}