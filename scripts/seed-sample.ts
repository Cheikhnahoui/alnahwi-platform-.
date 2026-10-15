import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { purgeSampleData, seedSampleData } from "../src/lib/db/seed-sample";

async function main() {
  const purge = process.argv.includes("--purge");
  if (!purge && process.env.NODE_ENV === "production") {
    throw new Error("Refusing to insert sample data when NODE_ENV=production.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    if (purge) {
      await purgeSampleData(db);
      console.log("Sample data removed.");
    } else {
      const r = await seedSampleData(db);
      console.log(
        `Sample data ready (${r.itemsCreated} new items). Remove it with: npm run db:purge:sample`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});