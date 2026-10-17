/**
 * One-time setup: creates the FIRST super administrator.
 *
 *   npm run admin:create -- --email you@example.org --name "الاسم"
 *
 * The password is typed at a hidden prompt (never on the command line, so it
 * stays out of shell history). For automation only, ADMIN_PASSWORD may be set.
 * Refuses to run if an active super admin already exists (add --allow-additional
 * to override). Run it against the database you want to use (see DATABASE_URL).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { AuthError, bootstrapSuperAdmin } from "../src/lib/auth/users";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY)
      return reject(new Error("No interactive terminal. Set ADMIN_PASSWORD instead."));
    process.stdout.write(prompt);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        } else if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        } else if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const email = arg("email");
  const name = arg("name");
  if (!email || !name) {
    throw new Error('Usage: npm run admin:create -- --email you@example.org --name "Full name"');
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await readHidden("Password (min 12 characters, hidden): ");
    const again = await readHidden("Repeat password: ");
    if (password !== again) throw new Error("Passwords do not match.");
  }

  const pool = new Pool({ connectionString: url });
  try {
    const user = await bootstrapSuperAdmin(drizzle(pool, { schema }), {
      email,
      name,
      password,
      allowAdditional: process.argv.includes("--allow-additional"),
    });
    console.log(`Super admin created: ${user.email}`);
    console.log("You can now sign in at /admin/login");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  if (e instanceof AuthError) {
    console.error(e.message);
    for (const d of e.details) console.error(" -", d);
  } else {
    console.error(e instanceof Error ? e.message : e);
  }
  process.exit(1);
});