import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { brandProduct, composition, listing, retailer } from "../db/schema";

// listing has no stored "why" for a review — derived from the confidence
// bands scripts/parse.ts writes: 0.6 = salt mismatch, 0.4 = dosage form
// inferred (both caps can apply at once; 0.4 wins since it's stricter).
export function reviewReason(confidence: number): string {
  if (confidence <= 0.4) return "Dosage form inferred from title/pack size, not stated in the composition text.";
  if (confidence <= 0.6) return "Salt/ester form differs between the two sides of this match (e.g. bare molecule vs. a salt form).";
  return "Below the auto-match confidence threshold.";
}

export interface PendingMatch {
  listingId: number;
  retailer: string;
  brandName: string;
  rawCompositionText: string | null;
  resolvedCompositionText: string | null;
  matchConfidence: number | null;
  reason: string;
  productUrl: string;
}

export async function pendingMatches(): Promise<PendingMatch[]> {
  const rows = await db
    .select({
      listingId: listing.id,
      retailer: retailer.name,
      brandName: brandProduct.canonicalName,
      rawCompositionText: listing.rawCompositionText,
      resolvedCompositionText: composition.normalizedText,
      matchConfidence: listing.matchConfidence,
      productUrl: listing.productUrl,
    })
    .from(listing)
    .innerJoin(retailer, eq(retailer.id, listing.retailerId))
    .leftJoin(brandProduct, eq(brandProduct.id, listing.brandProductId))
    .leftJoin(composition, eq(composition.id, brandProduct.compositionId))
    .where(eq(listing.matchStatus, "review"))
    .orderBy(desc(listing.matchConfidence));

  return rows.map((r) => {
    const confidence = r.matchConfidence === null ? null : Number(r.matchConfidence);
    return {
      listingId: r.listingId,
      retailer: r.retailer,
      brandName: r.brandName ?? "Unknown",
      rawCompositionText: r.rawCompositionText,
      resolvedCompositionText: r.resolvedCompositionText,
      matchConfidence: confidence,
      reason: confidence === null ? "No confidence recorded." : reviewReason(confidence),
      productUrl: r.productUrl,
    };
  });
}

export interface PendingMerge {
  id: number;
  moleculeAId: number;
  moleculeAName: string;
  moleculeBId: number;
  moleculeBName: string;
  similarity: number;
}

export async function pendingMerges(): Promise<PendingMerge[]> {
  const rows = await db.execute<{
    id: number;
    molecule_a_id: number;
    molecule_a_name: string;
    molecule_b_id: number;
    molecule_b_name: string;
    similarity: string;
  }>(sql`
    SELECT s.id, a.id AS molecule_a_id, a.name AS molecule_a_name,
      b.id AS molecule_b_id, b.name AS molecule_b_name, s.similarity
    FROM molecule_merge_suggestion s
    JOIN molecule a ON a.id = s.molecule_a_id
    JOIN molecule b ON b.id = s.molecule_b_id
    WHERE s.status = 'pending'
    ORDER BY s.similarity DESC
  `);

  return rows.map((r) => ({
    id: r.id,
    moleculeAId: r.molecule_a_id,
    moleculeAName: r.molecule_a_name,
    moleculeBId: r.molecule_b_id,
    moleculeBName: r.molecule_b_name,
    similarity: Number(r.similarity),
  }));
}
