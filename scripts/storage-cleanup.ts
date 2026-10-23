import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";
import { findAbandonedFileIds, releaseStoredFiles } from "../src/lib/storage/files";
import { vercelBlobStore } from "../src/lib/storage/store";

/** Deletes uploaded files that no material uses (older than 24 hours). Safe to run any time. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set (needed to delete the files from storage)");
  }
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const ids = await findAbandonedFileIds(db, 24);
    const removed = await releaseStoredFiles(db, vercelBlobStore, ids);
    console.log(`Removed ${removed} unused uploaded file(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
