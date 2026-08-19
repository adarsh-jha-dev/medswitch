import "dotenv/config";
import { eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { composition, compositionMolecule } from "../src/db/schema";
import { moleculeSetHash } from "../src/parse/fingerprint";

async function main() {
  const rows = await db
    .select({ id: composition.id })
    .from(composition)
    .where(isNull(composition.moleculeSetHash));

  let updated = 0;
  for (const row of rows) {
    const molecules = await db
      .select({ moleculeId: compositionMolecule.moleculeId })
      .from(compositionMolecule)
      .where(eq(compositionMolecule.compositionId, row.id));

    const hash = moleculeSetHash(molecules.map((m) => m.moleculeId));
    await db.update(composition).set({ moleculeSetHash: hash }).where(eq(composition.id, row.id));
    updated++;
  }

  console.log(`Backfilled molecule_set_hash for ${updated} composition rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
