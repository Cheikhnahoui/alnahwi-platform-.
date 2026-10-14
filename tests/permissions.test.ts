import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, roleHasPermission } from "@/lib/auth/permissions";

describe("role permissions", () => {
  it("super_admin has every permission", () => {
    for (const p of Object.keys(PERMISSIONS)) {
      expect(roleHasPermission("super_admin", p as keyof typeof PERMISSIONS)).toBe(true);
    }
  });
  it("editor cannot manage users, roles, publish or change settings", () => {
    for (const p of [
      "users.manage",
      "roles.manage",
      "content.publish",
      "settings.manage",
    ] as const) {
      expect(roleHasPermission("editor", p)).toBe(false);
    }
  });
  it("reviewer can review but not create, publish or manage users", () => {
    expect(roleHasPermission("reviewer", "content.review")).toBe(true);
    expect(roleHasPermission("reviewer", "content.create")).toBe(false);
    expect(roleHasPermission("reviewer", "content.publish")).toBe(false);
    expect(roleHasPermission("reviewer", "users.manage")).toBe(false);
  });
  it("only super_admin holds security-sensitive permissions", () => {
    for (const p of ["users.manage", "roles.manage", "audit.view", "settings.manage"] as const) {
      const holders = Object.keys(ROLES).filter((r) =>
        roleHasPermission(r as keyof typeof ROLES, p),
      );
      expect(holders).toEqual(["super_admin"]);
    }
  });
  it("every role permission exists in the catalogue", () => {
    for (const r of Object.values(ROLES)) {
      for (const p of r.permissions) expect(PERMISSIONS).toHaveProperty(p);
    }
  });
});
