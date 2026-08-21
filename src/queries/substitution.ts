import { sql } from "drizzle-orm";
import { db } from "../db";
import { annualSaving, pctCheaper, perUnit } from "./savings";

export interface SubstitutionListing {
  listingId: number;
  retailer: string;
  retailerSlug: string;
  brandName: string;
  manufacturer: string | null;
  isGeneric: boolean;
  packSize: string | null;
  packUnitCount: number;
  salePrice: number;
  mrp: number | null;
  perUnit: number;
  matchStatus: string;
  productUrl: string;
  capturedAt: string;
}

export interface CompositionMoleculeRow {
  name: string;
  strengthValue: string | null;
  strengthUnit: string | null;
}

export interface SubstitutionGroup {
  compositionId: number;
  fingerprintHash: string;
  normalizedText: string;
  dosageForm: string;
  releaseModifier: string | null;
  molecules: CompositionMoleculeRow[];
  ranked: SubstitutionListing[];
  pendingReview: SubstitutionListing[];
}

export interface Savings {
  cheapest: SubstitutionListing;
  priciest: SubstitutionListing;
  pctCheaper: number;
  annualSaving: number;
}

export function computeSavings(ranked: SubstitutionListing[]): Savings | null {
  if (ranked.length < 2) return null;
  const cheapest = ranked[0];
  const priciest = ranked[ranked.length - 1];
  if (cheapest.perUnit >= priciest.perUnit) return null;
  return {
    cheapest,
    priciest,
    pctCheaper: pctCheaper(cheapest.perUnit, priciest.perUnit),
    annualSaving: annualSaving(cheapest.perUnit, priciest.perUnit),
  };
}

type ListingRow = {
  listing_id: number;
  retailer: string;
  retailer_slug: string;
  brand_name: string;
  manufacturer: string | null;
  is_generic: boolean;
  pack_size: string | null;
  pack_unit_count: number;
  sale_price: string;
  mrp: string | null;
  match_status: string;
  product_url: string;
  captured_at: string;
};

function toListing(r: ListingRow): SubstitutionListing {
  const salePrice = Number(r.sale_price);
  return {
    listingId: r.listing_id,
    retailer: r.retailer,
    retailerSlug: r.retailer_slug,
    brandName: r.brand_name,
    manufacturer: r.manufacturer,
    isGeneric: r.is_generic,
    packSize: r.pack_size,
    packUnitCount: r.pack_unit_count,
    salePrice,
    mrp: r.mrp === null ? null : Number(r.mrp),
    perUnit: perUnit(salePrice, r.pack_unit_count),
    matchStatus: r.match_status,
    productUrl: r.product_url,
    capturedAt: r.captured_at,
  };
}

const LISTING_ROW_SQL = sql`
  SELECT
    l.id AS listing_id,
    r.name AS retailer,
    r.slug AS retailer_slug,
    bp.canonical_name AS brand_name,
    bp.manufacturer,
    bp.is_generic,
    bp.pack_size,
    bp.pack_unit_count,
    pp.sale_price,
    pp.mrp,
    l.match_status,
    l.product_url,
    pp.captured_at
  FROM listing l
  JOIN brand_product bp ON bp.id = l.brand_product_id
  JOIN composition c ON c.id = bp.composition_id
  JOIN retailer r ON r.id = l.retailer_id
  JOIN LATERAL (
    SELECT sale_price, mrp, captured_at FROM price_point
    WHERE listing_id = l.id ORDER BY captured_at DESC LIMIT 1
  ) pp ON TRUE
  WHERE bp.pack_unit_count IS NOT NULL AND pp.sale_price > 0
`;

// Includes single-retailer compositions with 2+ brands, not just
// cross-retailer matches — see docs/known-gaps.md for the actual count.
export interface BrowseGroup {
  fingerprintHash: string;
  normalizedText: string;
  dosageForm: string;
  retailerCount: number;
  brandCount: number;
  cheapestPerUnit: number | null;
  savingsPct: number | null;
}

export async function listSubstitutionGroups(): Promise<BrowseGroup[]> {
  const rows = await db.execute<{
    fingerprint_hash: string;
    normalized_text: string;
    dosage_form: string;
    retailer_count: number;
    brand_count: number;
    cheapest: string | null;
    priciest: string | null;
  }>(sql`
    SELECT
      c.fingerprint_hash,
      c.normalized_text,
      c.dosage_form,
      COUNT(DISTINCT r.id)::int AS retailer_count,
      COUNT(DISTINCT bp.id)::int AS brand_count,
      MIN(ROUND(pp.sale_price / bp.pack_unit_count, 2)) AS cheapest,
      MAX(ROUND(pp.sale_price / bp.pack_unit_count, 2)) AS priciest
    FROM composition c
    JOIN brand_product bp ON bp.composition_id = c.id
    JOIN listing l ON l.brand_product_id = bp.id AND l.match_status IN ('auto', 'verified')
    JOIN retailer r ON r.id = l.retailer_id
    JOIN LATERAL (
      SELECT sale_price FROM price_point
      WHERE listing_id = l.id ORDER BY captured_at DESC LIMIT 1
    ) pp ON TRUE
    WHERE bp.pack_unit_count IS NOT NULL AND pp.sale_price > 0
    GROUP BY c.id, c.fingerprint_hash, c.normalized_text, c.dosage_form
    HAVING COUNT(DISTINCT r.id) >= 2 OR COUNT(DISTINCT bp.id) >= 2
    ORDER BY c.normalized_text
  `);

  return rows.map((r) => {
    const cheapest = r.cheapest === null ? null : Number(r.cheapest);
    const priciest = r.priciest === null ? null : Number(r.priciest);
    return {
      fingerprintHash: r.fingerprint_hash,
      normalizedText: r.normalized_text,
      dosageForm: r.dosage_form,
      retailerCount: r.retailer_count,
      brandCount: r.brand_count,
      cheapestPerUnit: cheapest,
      savingsPct: cheapest !== null && priciest !== null ? pctCheaper(cheapest, priciest) : null,
    };
  });
}

export async function getSubstitutionGroup(fingerprintHash: string): Promise<SubstitutionGroup | null> {
  const [comp] = await db.execute<{
    id: number;
    fingerprint_hash: string;
    normalized_text: string;
    dosage_form: string;
    release_modifier: string | null;
  }>(sql`
    SELECT id, fingerprint_hash, normalized_text, dosage_form, release_modifier
    FROM composition WHERE fingerprint_hash = ${fingerprintHash}
  `);
  if (!comp) return null;

  const molecules = await db.execute<{ name: string; strength_value: string | null; strength_unit: string | null }>(sql`
    SELECT m.name, cm.strength_value, cm.strength_unit
    FROM composition_molecule cm
    JOIN molecule m ON m.id = cm.molecule_id
    WHERE cm.composition_id = ${comp.id}
    ORDER BY m.name
  `);

  const listingRows = await db.execute<ListingRow>(sql`
    ${LISTING_ROW_SQL}
      AND c.id = ${comp.id}
      AND l.match_status IN ('auto', 'verified', 'review')
    ORDER BY pp.sale_price / bp.pack_unit_count ASC
  `);

  const listings = listingRows.map(toListing);
  const ranked = listings.filter((l) => l.matchStatus !== "review").sort((a, b) => a.perUnit - b.perUnit);
  const pendingReview = listings.filter((l) => l.matchStatus === "review").sort((a, b) => a.perUnit - b.perUnit);

  return {
    compositionId: comp.id,
    fingerprintHash: comp.fingerprint_hash,
    normalizedText: comp.normalized_text,
    dosageForm: comp.dosage_form,
    releaseModifier: comp.release_modifier,
    molecules: molecules.map((m) => ({ name: m.name, strengthValue: m.strength_value, strengthUnit: m.strength_unit })),
    ranked,
    pendingReview,
  };
}

// searchProducts()[0] is a deliberate narrowing — ambiguous queries should go through /?q= instead.
export async function resolveSubstitutionGroup(query: string): Promise<SubstitutionGroup | null> {
  const candidates = await searchProducts(query);
  if (candidates.length === 0) return null;
  return getSubstitutionGroup(candidates[0].fingerprintHash);
}

export interface SearchResult {
  fingerprintHash: string;
  normalizedText: string;
  matchedOn: string;
}

// Plain ILIKE, not trigram similarity — a human picks the result, so a
// missed fuzzy match is fine.
export async function searchProducts(q: string): Promise<SearchResult[]> {
  const query = q.trim();
  if (!query) return [];
  const pattern = `%${query}%`;

  const byBrand = await db.execute<{ fingerprint_hash: string; normalized_text: string; brand_name: string }>(sql`
    SELECT DISTINCT c.fingerprint_hash, c.normalized_text, bp.canonical_name AS brand_name
    FROM brand_product bp
    JOIN composition c ON c.id = bp.composition_id
    WHERE bp.canonical_name ILIKE ${pattern}
    LIMIT 20
  `);

  const byMolecule = await db.execute<{ fingerprint_hash: string; normalized_text: string; molecule_name: string }>(sql`
    SELECT DISTINCT c.fingerprint_hash, c.normalized_text, m.name AS molecule_name
    FROM composition_molecule cm
    JOIN composition c ON c.id = cm.composition_id
    JOIN molecule m ON m.id = cm.molecule_id
    WHERE m.name ILIKE ${pattern}
    LIMIT 20
  `);

  const seen = new Map<string, SearchResult>();
  for (const r of byBrand) {
    if (!seen.has(r.fingerprint_hash)) {
      seen.set(r.fingerprint_hash, { fingerprintHash: r.fingerprint_hash, normalizedText: r.normalized_text, matchedOn: r.brand_name });
    }
  }
  for (const r of byMolecule) {
    if (!seen.has(r.fingerprint_hash)) {
      seen.set(r.fingerprint_hash, { fingerprintHash: r.fingerprint_hash, normalizedText: r.normalized_text, matchedOn: r.molecule_name });
    }
  }
  return [...seen.values()].slice(0, 20);
}
