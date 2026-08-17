import "dotenv/config";
import { db } from "../src/db";
import { molecule, retailer } from "../src/db/schema";

// Scoped to Day 1's three therapeutic categories: antihypertensives,
// antidiabetics, analgesics (see docs/targets.md).
const MOLECULES = [
  "Amlodipine",
  "Telmisartan",
  "Losartan Potassium",
  "Metoprolol Succinate",
  "Metformin Hydrochloride",
  "Glimepiride",
  "Sitagliptin Phosphate",
  "Voglibose",
  "Paracetamol",
  "Diclofenac Sodium",
  "Ibuprofen",
  "Aceclofenac",
];

const RETAILERS = [
  {
    name: "Jan Aushadhi",
    slug: "janaushadhi",
    // Public price list actually lives on the legacy PMBI site, not
    // janaushadhi.gov.in (a client-only SPA) — see docs/targets.md.
    baseUrl: "https://www.pmbi.co.in",
  },
  {
    name: "PharmEasy",
    slug: "pharmeasy",
    baseUrl: "https://pharmeasy.in",
  },
];

async function main() {
  for (const m of MOLECULES) {
    await db
      .insert(molecule)
      .values({ name: m, normalizedName: m.toLowerCase() })
      .onConflictDoNothing({ target: molecule.normalizedName });
  }

  for (const r of RETAILERS) {
    await db.insert(retailer).values(r).onConflictDoNothing({ target: retailer.slug });
  }

  console.log(`Seeded ${MOLECULES.length} molecules and ${RETAILERS.length} retailers.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
