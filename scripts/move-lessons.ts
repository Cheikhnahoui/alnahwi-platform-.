import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/db/schema";

/** One-time: moves every material of type "lesson" to "lecture" (محاضرات ودروس). Safe to run twice. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    const types = await db.select().from(schema.contentTypes);
    const lesson = types.find((t) => t.key === "lesson");
    const lecture = types.find((t) => t.key === "lecture");
    if (!lesson || !lecture) throw new Error("Types lesson/lecture not found");
    const moved = await db
      .update(schema.contentItems)
      .set({ contentTypeId: lecture.id })
      .where(eq(schema.contentItems.contentTypeId, lesson.id))
      .returning({ title: schema.contentItems.title });
    console.log("Moved " + moved.length + " material(s) from lesson to lecture.");
    for (const m of moved) console.log(" - " + m.title);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
