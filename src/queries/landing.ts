import { sql } from "drizzle-orm";
import { db } from "../db";
import { allBannedMatchesGrouped } from "./banned";
import { listSubstitutionGroups, type BrowseGroup } from "./substitution";

export interface LandingStats {
  totalListings: number;
  retailerCount: number;
  crossRetailerGroups: number;
  confirmedBanned: number;
  topSaving: BrowseGroup | null;
}

export async function getLandingStats(): Promise<LandingStats> {
  const [[counts], groups, banned] = await Promise.all([
    db.execute<{ listings: number; retailers: number }>(sql`
      SELECT (SELECT COUNT(*) FROM listing)::int AS listings, (SELECT COUNT(*) FROM retailer)::int AS retailers
    `),
    listSubstitutionGroups(),
    allBannedMatchesGrouped(),
  ]);

  const crossRetailer = groups.filter((g) => g.retailerCount >= 2);
  const withSavings = crossRetailer.filter((g) => g.savingsPct !== null);
  const topSaving = [...withSavings].sort((a, b) => (b.savingsPct ?? 0) - (a.savingsPct ?? 0))[0] ?? null;

  return {
    totalListings: counts.listings,
    retailerCount: counts.retailers,
    crossRetailerGroups: crossRetailer.length,
    confirmedBanned: banned.confirmed.length,
    topSaving,
  };
}
