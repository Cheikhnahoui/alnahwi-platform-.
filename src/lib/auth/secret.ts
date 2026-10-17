import { createHmac } from "node:crypto";

/**
 * Secret used only to key-hash identifiers (emails, IPs) for rate limiting.
 * Required in production; read lazily so the PUBLIC site never depends on it.
 */
export function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  }
  return "development-only-secret-do-not-use-in-production";
}

export function keyedHash(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}