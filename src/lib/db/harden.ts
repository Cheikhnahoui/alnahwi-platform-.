/**
 * Locks the database down for hosts that publish the `public` schema through an
 * HTTP API (Supabase's "Data API"). Idempotent; safe on plain PostgreSQL too.
 *
 * What it does
 * 1. Enables row-level security on EVERY table in `public`. No policies are
 *    created, so API roles (anon/authenticated) see nothing. The application
 *    connects as the table owner, which bypasses RLS, so it keeps working.
 * 2. If the Supabase roles `anon` / `authenticated` exist, revokes their table
 *    privileges, including default privileges for tables created later.
 *
 * `npm run db:migrate` runs this automatically after the migrations, so a new
 * table can never be left exposed. This database is meant for this app only.
 */
import { sql } from "drizzle-orm";
import type { AnyDb } from "./types";

export async function hardenDatabase(db: AnyDb): Promise<void> {
  await db.execute(sql`
    DO $harden$
    DECLARE
      t record;
      r text;
    BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      END LOOP;

      FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
          EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
          EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
          EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
        END IF;
      END LOOP;
    END
    $harden$;
  `);
}