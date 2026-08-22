import { sql } from "drizzle-orm";
import { db } from "../db";

export interface OverspendRow {
  compositionId: number;
  normalizedText: string;
  brandName: string;
  retailer: string;
  perUnit: number;
  janPerUnit: number;
  markup: number;
  annualOverspend: number;
}

export interface OverspendSummary {
  rows: OverspendRow[];
  groupCount: number;
  listingCount: number;
  medianMarkup: number;
  totalAnnualOverspend: number;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

// Every branded listing that shares a composition with a priced Jan Aushadhi
// generic, compared per unit against that generic's cheapest listing. One
// query across every match we have, not a single hand-picked example.
export async function getOverspendSummary(): Promise<OverspendSummary> {
  const rows = await db.execute<{
    composition_id: number;
    normalized_text: string;
    brand_name: string;
    retailer: string;
    per_unit: string;
    jan_per_unit: string;
  }>(sql`
    WITH jan_price AS (
      SELECT c.id AS composition_id, MIN(ROUND(pp.sale_price / bp.pack_unit_count, 2)) AS per_unit
      FROM composition c
      JOIN brand_product bp ON bp.composition_id = c.id
      JOIN listing l ON l.brand_product_id = bp.id AND l.match_status IN ('auto', 'verified')
      JOIN retailer r ON r.id = l.retailer_id AND r.slug = 'janaushadhi'
      JOIN LATERAL (
        SELECT sale_price FROM price_point WHERE listing_id = l.id ORDER BY captured_at DESC LIMIT 1
      ) pp ON TRUE
      WHERE bp.pack_unit_count IS NOT NULL AND pp.sale_price > 0
      GROUP BY c.id
    )
    SELECT
      c.id AS composition_id,
      c.normalized_text,
      bp.canonical_name AS brand_name,
      r.name AS retailer,
      ROUND(pp.sale_price / bp.pack_unit_count, 2) AS per_unit,
      jp.per_unit AS jan_per_unit
    FROM composition c
    JOIN brand_product bp ON bp.composition_id = c.id
    JOIN listing l ON l.brand_product_id = bp.id AND l.match_status IN ('auto', 'verified')
    JOIN retailer r ON r.id = l.retailer_id AND r.slug != 'janaushadhi'
    JOIN LATERAL (
      SELECT sale_price FROM price_point WHERE listing_id = l.id ORDER BY captured_at DESC LIMIT 1
    ) pp ON TRUE
    JOIN jan_price jp ON jp.composition_id = c.id
    WHERE bp.pack_unit_count IS NOT NULL AND pp.sale_price > 0 AND jp.per_unit > 0
    ORDER BY (pp.sale_price / bp.pack_unit_count / jp.per_unit) DESC
  `);

  const parsed: OverspendRow[] = rows.map((r) => {
    const perUnit = Number(r.per_unit);
    const janPerUnit = Number(r.jan_per_unit);
    return {
      compositionId: r.composition_id,
      normalizedText: r.normalized_text,
      brandName: r.brand_name,
      retailer: r.retailer,
      perUnit,
      janPerUnit,
      markup: Math.round((perUnit / janPerUnit) * 100) / 100,
      annualOverspend: Math.max(0, Math.round((perUnit - janPerUnit) * 365)),
    };
  });

  return {
    rows: parsed,
    groupCount: new Set(parsed.map((r) => r.compositionId)).size,
    listingCount: parsed.length,
    medianMarkup: median(parsed.map((r) => r.markup)),
    totalAnnualOverspend: parsed.reduce((sum, r) => sum + r.annualOverspend, 0),
  };
}
