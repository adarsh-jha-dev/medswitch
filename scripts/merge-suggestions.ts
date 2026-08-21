import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { moleculeMergeSuggestion } from "../src/db/schema";

// 0.85 caught none of the real typo duplicates (they score 0.75-0.81); 0.7 catches most, see README for the gap.
const SIMILARITY_THRESHOLD = 0.7;

// pg_trgm, not embeddings — embeddings could just as easily merge two different drugs. Suggest only, never auto-merge.
async function main() {
  const pairs = await db.execute<{ a_id: number; b_id: number; sim: number }>(sql`
    SELECT a.id AS a_id, b.id AS b_id, similarity(a.normalized_name, b.normalized_name) AS sim
    FROM molecule a
    JOIN molecule b ON a.id < b.id
    WHERE similarity(a.normalized_name, b.normalized_name) > ${SIMILARITY_THRESHOLD}
    ORDER BY sim DESC
  `);

  let inserted = 0;
  for (const pair of pairs) {
    const result = await db
      .insert(moleculeMergeSuggestion)
      .values({
        moleculeAId: pair.a_id,
        moleculeBId: pair.b_id,
        similarity: pair.sim.toFixed(3),
      })
      .onConflictDoNothing({ target: [moleculeMergeSuggestion.moleculeAId, moleculeMergeSuggestion.moleculeBId] })
      .returning({ id: moleculeMergeSuggestion.id });
    if (result.length > 0) inserted++;
  }

  console.log(`${pairs.length} candidate pairs above similarity ${SIMILARITY_THRESHOLD}, ${inserted} new suggestions written.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
