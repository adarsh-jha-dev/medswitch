import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  const groups = await db.execute<{ fingerprint_hash: string; normalized_text: string }>(sql`
    SELECT c.fingerprint_hash, c.normalized_text
    FROM composition c
    JOIN brand_product bp ON bp.composition_id = c.id
    JOIN listing l ON l.brand_product_id = bp.id
    JOIN LATERAL (
      SELECT sale_price FROM price_point
      WHERE listing_id = l.id ORDER BY captured_at DESC LIMIT 1
    ) pp ON TRUE
    WHERE l.match_status IN ('auto', 'verified') AND bp.pack_unit_count IS NOT NULL AND pp.sale_price > 0
    GROUP BY c.fingerprint_hash, c.normalized_text
    HAVING COUNT(DISTINCT l.retailer_id) >= 2
    ORDER BY c.normalized_text
  `);

  console.log(`${groups.length} compositions have a cross-retailer price comparison available.\n`);

  for (const group of groups) {
    console.log(`=== ${group.normalized_text} ===`);

    const rows = await db.execute<{
      retailer: string;
      canonical_name: string;
      sale_price: string;
      pack_unit_count: number;
      per_unit: string;
    }>(sql`
      SELECT r.name AS retailer, bp.canonical_name, pp.sale_price, bp.pack_unit_count,
             ROUND(pp.sale_price / bp.pack_unit_count, 2) AS per_unit
      FROM listing l
      JOIN brand_product bp ON bp.id = l.brand_product_id
      JOIN composition c ON c.id = bp.composition_id
      JOIN retailer r ON r.id = l.retailer_id
      JOIN LATERAL (
        SELECT sale_price FROM price_point
        WHERE listing_id = l.id ORDER BY captured_at DESC LIMIT 1
      ) pp ON TRUE
      WHERE c.fingerprint_hash = ${group.fingerprint_hash}
        AND l.match_status IN ('auto', 'verified')
        AND bp.pack_unit_count IS NOT NULL
        AND pp.sale_price > 0
      ORDER BY per_unit ASC
    `);

    for (const row of rows) {
      console.log(
        `  ${row.retailer.padEnd(14)} ${row.canonical_name.padEnd(32)} ₹${row.sale_price}/${row.pack_unit_count} = ₹${row.per_unit}/unit`,
      );
    }

    if (rows.length >= 2) {
      const cheapest = Number(rows[0].per_unit);
      const priciest = Number(rows[rows.length - 1].per_unit);
      if (priciest > 0) {
        const pct = (((priciest - cheapest) / priciest) * 100).toFixed(0);
        const annualSavings = ((priciest - cheapest) * 365).toFixed(0);
        console.log(`  -> ${pct}% cheaper at ${rows[0].retailer} (₹${annualSavings}/year at one unit/day)`);
      }
    }
    console.log();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
