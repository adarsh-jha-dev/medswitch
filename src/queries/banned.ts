import { sql } from "drizzle-orm";
import { db } from "../db";
import { findBannedFdcMatches, type BannedFdcMatch } from "../parse/banned-match";

export { findBannedFdcMatches, type BannedFdcMatch };

export async function bannedMatchesByCompositionId(compositionId: number): Promise<BannedFdcMatch[]> {
  const all = await findBannedFdcMatches();
  return all.filter((m) => m.compositionId === compositionId);
}

export async function allBannedMatchesGrouped(): Promise<{ confirmed: BannedFdcMatch[]; candidates: BannedFdcMatch[] }> {
  const all = await findBannedFdcMatches();
  return {
    confirmed: all.filter((m) => m.tier === "confirmed"),
    candidates: all.filter((m) => m.tier === "candidate"),
  };
}

// findBannedFdcMatches() is keyed on composition_id; /safety needs
// fingerprint_hash to link to a composition page.
export async function compositionFingerprintsByIds(compositionIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(compositionIds)];
  const map = new Map<number, string>();
  if (ids.length === 0) return map;

  const rows = await db.execute<{ id: number; fingerprint_hash: string }>(sql`
    SELECT id, fingerprint_hash FROM composition WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `);
  for (const r of rows) map.set(r.id, r.fingerprint_hash);
  return map;
}
