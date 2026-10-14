import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";

/** A fresh in-memory PostgreSQL with the real migrations applied. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, client };
}

/** Extracts the PostgreSQL error code from a (possibly wrapped) driver error. */
export function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

export async function expectPgError(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    if (pgCode(err) !== code) {
      throw new Error(`Expected PG error ${code}, got ${pgCode(err)}: ${String(err)}`);
    }
    return;
  }
  throw new Error(`Expected PG error ${code}, but the statement succeeded`);
}
