import "dotenv/config";
import { db } from "../src/db";
import { molecule, moleculeAlias, retailer } from "../src/db/schema";
import { ALIAS_SEED } from "../src/parse/alias-seed";
import { normalizeMoleculeName } from "../src/parse/resolve";
import { SEED_MOLECULE_NAMES as MOLECULES } from "../src/parse/seed-molecules";

const RETAILERS = [
  {
    name: "Jan Aushadhi",
    slug: "janaushadhi",
    // Public price list lives on the legacy PMBI site, not the JS-only janaushadhi.gov.in — see docs/targets.md.
    baseUrl: "https://www.pmbi.co.in",
  },
  {
    name: "PharmEasy",
    slug: "pharmeasy",
    baseUrl: "https://pharmeasy.in",
  },
  {
    name: "Apollo Pharmacy",
    slug: "apollo",
    baseUrl: "https://www.apollopharmacy.in",
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

  const molecules = await db.select({ id: molecule.id, normalizedName: molecule.normalizedName }).from(molecule);
  const byNormalizedName = new Map(molecules.map((m) => [m.normalizedName, m.id]));

  let aliasCount = 0;
  for (const { moleculeName, aliases } of ALIAS_SEED) {
    const moleculeId = byNormalizedName.get(normalizeMoleculeName(moleculeName));
    if (!moleculeId) {
      console.warn(`Skipping aliases for unknown molecule "${moleculeName}" — seed MOLECULES first.`);
      continue;
    }
    for (const alias of aliases) {
      await db
        .insert(moleculeAlias)
        .values({ moleculeId, alias, normalizedAlias: normalizeMoleculeName(alias) })
        .onConflictDoNothing({ target: moleculeAlias.normalizedAlias });
      aliasCount++;
    }
  }

  console.log(
    `Seeded ${MOLECULES.length} molecules, ${RETAILERS.length} retailers, ${aliasCount} molecule aliases.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
