import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { hardenDatabase } from "../src/lib/db/harden";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
    await hardenDatabase(db);
    console.log("Database hardened (row-level security on, API roles revoked).");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});