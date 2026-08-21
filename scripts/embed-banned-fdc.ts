import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { bannedFdc } from "../src/db/schema";
import { embedBatch } from "../src/parse/embed";

// One row per notification, no chunking needed — re-running re-embeds all 156 rows in one batched call.
async function main() {
  const rows = await db.select({ id: bannedFdc.id, rawText: bannedFdc.rawText }).from(bannedFdc);
  if (rows.length === 0) {
    console.log("No banned_fdc rows found — run `pnpm banned:ingest` first.");
    process.exit(0);
  }

  const embeddings = await embedBatch(rows.map((r) => r.rawText));

  for (let i = 0; i < rows.length; i++) {
    await db
      .update(bannedFdc)
      .set({ embedding: embeddings[i] })
      .where(eq(bannedFdc.id, rows[i].id));
  }

  const [{ count }] = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::int AS count FROM banned_fdc WHERE embedding IS NOT NULL
  `);

  console.log(`banned_fdc: embedded ${rows.length} rows (${count} total now have an embedding).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
