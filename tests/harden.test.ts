import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import { hardenDatabase } from "@/lib/db/harden";
import { createTestDb } from "./helpers/db";

/** A database that behaves like Supabase: anon/authenticated get access to new tables by default. */
async function supabaseLikeDb() {
  const client = new PGlite();
  await client.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
  `);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { client, db };
}

const publicTables = (c: PGlite) =>
  c.query<{ relname: string; relrowsecurity: boolean }>(
    `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`,
  );

describe("database hardening (Supabase-style exposure)", () => {
  const opened: PGlite[] = [];
  afterAll(async () => {
    for (const c of opened) await c.close();
  });

  it("proves the problem first: migrated tables are open to the API roles", async () => {
    const { client } = await supabaseLikeDb();
    opened.push(client);
    const rows = (await publicTables(client)).rows;
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.relrowsecurity === false)).toBe(true);
    const open = await client.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', 'public.content_items', 'SELECT') AS ok`,
    );
    expect(open.rows[0].ok).toBe(true);
    // ...and anon can really read drafts:
    await client.exec(`SET ROLE anon`);
    await expect(client.query(`SELECT count(*) FROM content_items`)).resolves.toBeDefined();
    await client.exec(`RESET ROLE`);
  });

  it("enables RLS on all 20 tables and revokes API-role access", async () => {
    const { client, db } = await supabaseLikeDb();
    opened.push(client);
    await hardenDatabase(db);
    const rows = (await publicTables(client)).rows;
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.relrowsecurity === true)).toBe(true);
    for (const role of ["anon", "authenticated"]) {
      for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        const r = await client.query<{ ok: boolean }>(
          `SELECT bool_or(has_table_privilege('${role}', format('public.%I', relname), '${priv}')) AS ok
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r'`,
        );
        expect(r.rows[0].ok).toBe(false);
      }
    }
    // The API role can no longer read anything.
    await client.exec(`SET ROLE anon`);
    await expect(client.query(`SELECT * FROM content_items`)).rejects.toThrow(/permission denied/i);
    await expect(client.query(`SELECT * FROM contact_messages`)).rejects.toThrow(
      /permission denied/i,
    );
    await client.exec(`RESET ROLE`);
  });

  it("covers tables created later and is idempotent", async () => {
    const { client, db } = await supabaseLikeDb();
    opened.push(client);
    await hardenDatabase(db);
    await client.exec(`CREATE TABLE public.future_table (id int)`); // e.g. a Phase 4 table
    expect(
      (
        await client.query<{ ok: boolean }>(
          `SELECT has_table_privilege('anon', 'public.future_table', 'SELECT') AS ok`,
        )
      ).rows[0].ok,
    ).toBe(false); // default privileges were revoked
    await hardenDatabase(db);
    await hardenDatabase(db); // running again changes nothing and does not fail
    const future = (await publicTables(client)).rows.find((r) => r.relname === "future_table");
    expect(future?.relrowsecurity).toBe(true);
  });

  it("works on plain PostgreSQL without Supabase roles, and the app keeps access", async () => {
    const { db, client } = await createTestDb();
    opened.push(client);
    await hardenDatabase(db);
    expect((await publicTables(client)).rows.every((r) => r.relrowsecurity)).toBe(true);
    const types = await db.select().from(schema.contentTypes);
    expect(Array.isArray(types)).toBe(true); // owner/superuser connection is unaffected
  });
});