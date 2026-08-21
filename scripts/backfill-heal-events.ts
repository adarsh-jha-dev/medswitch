import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { healEvent, retailer } from "../src/db/schema";
import { COLLECTOR_IDS } from "../src/ingest/collector-ids";

// The two Bright Data heals documented in CLAUDE.md for the Jan Aushadhi collector, backfilled as real heal_event rows.
const EVENTS = [
  {
    fieldName: null,
    symptom: "results array came back empty on every row from the newly created collector",
    healPrompt: "results is empty on every row — fields need to be flat top-level, not nested under a results key",
    rowsBefore: 0,
    rowsAfter: 77,
  },
  {
    fieldName: null,
    symptom: "search box was not filtering — a Metformin search returned ~1450 unrelated rows instead of the ~77 matching rows",
    healPrompt: "the search box is not filtering results — it returns the entire product list regardless of the search term instead of only matching rows",
    rowsBefore: 1450,
    rowsAfter: 77,
  },
];

async function main() {
  const [row] = await db.select({ id: retailer.id }).from(retailer).where(eq(retailer.slug, "janaushadhi"));
  if (!row) throw new Error("retailer 'janaushadhi' not seeded — run pnpm db:seed first");

  for (const e of EVENTS) {
    await db.insert(healEvent).values({
      retailerId: row.id,
      collectorId: COLLECTOR_IDS.janaushadhi,
      fieldName: e.fieldName,
      symptom: e.symptom,
      healPrompt: e.healPrompt,
      rowsBefore: e.rowsBefore,
      rowsAfter: e.rowsAfter,
      healedAt: new Date(),
    });
  }

  console.log(`Backfilled ${EVENTS.length} heal_event rows for janaushadhi.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
