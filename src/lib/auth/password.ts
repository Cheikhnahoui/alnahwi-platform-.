/**
 * Password hashing with scrypt from Node's standard library (no native add-ons).
 * Parameters follow OWASP's scrypt guidance (N=2^15, r=8, p=3).
 * Stored format: scrypt$N$r$p$saltBase64$keyBase64 — parameters travel with the hash,
 * so they can be raised later and old hashes still verify.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 32_768;
const R = 8;
const P = 3;
const KEY_LEN = 64;
const MAX_N = 131_072; // refuse absurd parameters from a tampered row (DoS guard)
const MAXMEM = 256 * 1024 * 1024;

function scryptAsync(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  len: number,
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, len, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, N, R, P, KEY_LEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Never throws: malformed or tampered hashes simply fail verification. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
    if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
    const nn = Number(n);
    const rr = Number(r);
    const pp = Number(p);
    if (
      ![nn, rr, pp].every(Number.isInteger) ||
      nn < 2 ||
      nn > MAX_N ||
      rr < 1 ||
      rr > 32 ||
      pp < 1 ||
      pp > 16
    ) {
      return false;
    }
    const expected = Buffer.from(keyB64, "base64");
    if (expected.length < 16) return false;
    const actual = await scryptAsync(
      password,
      Buffer.from(saltB64, "base64"),
      nn,
      rr,
      pp,
      expected.length,
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;
/** A valid hash of a random password, used to spend equal time when an account does not exist. */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(24).toString("base64url"));
  return dummy;
}

const DENYLIST = new Set([
  "password1234",
  "password12345",
  "123456789012",
  "1234567890123",
  "qwertyuiop12",
  "administrator",
  "adminadmin123",
  "motdepasse123",
]);

/** Length-based policy (NIST style): returns Arabic error messages, empty array = acceptable. */
export function validatePassword(
  password: string,
  ctx: { email?: string; name?: string } = {},
): string[] {
  const errors: string[] = [];
  if (password.length < 12) errors.push("كلمة المرور يجب ألا تقل عن 12 حرفًا.");
  if (password.length > 128) errors.push("كلمة المرور يجب ألا تزيد على 128 حرفًا.");
  if (/^(.)\1+$/.test(password)) errors.push("كلمة المرور لا يجوز أن تكون حرفًا واحدًا مكررًا.");
  const lower = password.toLowerCase();
  if (DENYLIST.has(lower)) errors.push("كلمة المرور شائعة جدًا.");
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) {
    errors.push("كلمة المرور لا يجوز أن تحتوي على جزء من البريد الإلكتروني.");
  }
  return errors;
}