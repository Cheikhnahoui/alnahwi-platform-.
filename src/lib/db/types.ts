import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any Drizzle PostgreSQL database or transaction (node-postgres, PGlite, ...). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<any, typeof schema>;