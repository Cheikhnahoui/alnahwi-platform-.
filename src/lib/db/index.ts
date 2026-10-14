import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

/** Lazy singleton so importing this module never needs a live database. */
export function getDb(): Database {
  if (!globalForDb.__pgPool) {
    globalForDb.__pgPool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
    });
  }
  return drizzle(globalForDb.__pgPool, { schema });
}

export { schema };
