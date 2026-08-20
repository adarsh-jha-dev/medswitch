import "dotenv/config";
import { computeSavings, getSubstitutionGroup, listSubstitutionGroups } from "../src/queries/substitution";

async function main() {
  const groups = await listSubstitutionGroups();
  console.log(`${groups.length} composition groups have a cross-retailer or cross-brand comparison available.\n`);

  for (const summary of groups) {
    const group = await getSubstitutionGroup(summary.fingerprintHash);
    if (!group) continue;

    console.log(`=== ${group.normalizedText} ===`);
    for (const row of group.ranked) {
      console.log(
        `  ${row.retailer.padEnd(14)} ${row.brandName.padEnd(32)} ₹${row.salePrice}/${row.packUnitCount} = ₹${row.perUnit}/unit`,
      );
    }

    const savings = computeSavings(group.ranked);
    if (savings) {
      console.log(`  -> ${savings.pctCheaper}% cheaper at ${savings.cheapest.retailer} (₹${savings.annualSaving}/year at one unit/day)`);
    }
    console.log();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
