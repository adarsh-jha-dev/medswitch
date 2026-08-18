import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { listing, molecule, retailer } from "../src/db/schema";
import { parseStructured } from "../src/parse/grammar";
import { normalizeMoleculeName } from "../src/parse/resolve";
import { SEED_MOLECULE_NAMES } from "../src/parse/seed-molecules";

async function main() {
  const rows = await db
    .select({
      raw: listing.rawCompositionText,
      matchStatus: listing.matchStatus,
    })
    .from(listing)
    .innerJoin(retailer, eq(retailer.id, listing.retailerId));

  let regexCount = 0;
  let llmCount = 0;
  let noneCount = 0;
  for (const r of rows) {
    if (!r.raw) {
      noneCount++;
    } else if (parseStructured(r.raw)) {
      regexCount++;
    } else {
      llmCount++;
    }
  }

  console.log("=== Rows parsed by method ===");
  console.log(`regex:                ${regexCount}`);
  console.log(`llm:                  ${llmCount}`);
  console.log(`no composition text:  ${noneCount}`);
  const parsedTotal = regexCount + llmCount;
  if (parsedTotal > 0) {
    console.log(`${((regexCount / parsedTotal) * 100).toFixed(0)}% parsed deterministically, LLM only for the messy tail.`);
  }

  console.log("\n=== match_status distribution ===");
  const statusCounts = new Map<string, number>();
  for (const r of rows) statusCounts.set(r.matchStatus, (statusCounts.get(r.matchStatus) ?? 0) + 1);
  for (const [status, count] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${status.padEnd(10)} ${count}`);
  }

  console.log("\n=== Molecules outside the Day 1 seed list (auto-created during resolution), by usage frequency ===");
  const seedNormalized = new Set(SEED_MOLECULE_NAMES.map(normalizeMoleculeName));
  const molecules = await db.select({ id: molecule.id, name: molecule.name, normalizedName: molecule.normalizedName }).from(molecule);
  const newMolecules = molecules.filter((m) => !seedNormalized.has(m.normalizedName));

  if (newMolecules.length === 0) {
    console.log("(none — every resolved molecule matched or aliased to the Day 1 seed list)");
  } else {
    const freqResult = await db.execute<{ name: string; uses: number }>(sql`
      SELECT m.name AS name, COUNT(*)::int AS uses
      FROM composition_molecule cm
      JOIN molecule m ON m.id = cm.molecule_id
      WHERE m.id IN (${sql.join(newMolecules.map((m) => sql`${m.id}`), sql`, `)})
      GROUP BY m.name
      ORDER BY uses DESC
    `);
    for (const row of freqResult) {
      console.log(`  ${String(row.uses).padStart(3)}x  ${row.name}`);
    }
  }

  console.log("\n=== Composition groups spanning both retailers ===");
  const bothResult = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM (
      SELECT bp.composition_id
      FROM listing l
      JOIN brand_product bp ON bp.id = l.brand_product_id
      GROUP BY bp.composition_id
      HAVING COUNT(DISTINCT l.retailer_id) >= 2
    ) t
  `);
  const groupCount = bothResult[0]?.count ?? 0;
  console.log(`${groupCount} composition groups have listings from both retailers.`);
  if (groupCount < 15) {
    console.log("Fewer than ~15 — the demo needs breadth of examples. Consider widening PharmEasy discovery before adding features.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
