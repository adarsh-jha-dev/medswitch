import { sql } from "drizzle-orm";
import { db } from "../db";

// Two-tier join, never conflated: molecule_set_hash equality is a candidate
// (same molecule set, CDSCO's own granularity — no strength, dosage form, or
// release modifier). A candidate is promoted to confirmed only when the
// notification also states strengths and every one of them matches a
// composition_molecule row exactly. A notification that never states a
// strength at all stays a candidate forever — there is nothing to confirm it
// against, even though it may well cover every strength in practice.
export interface BannedFdcMatch {
  compositionId: number;
  compositionText: string;
  bannedFdcId: number;
  notificationRef: string;
  notificationDate: string | null;
  status: string;
  rawText: string;
  tier: "candidate" | "confirmed";
}

interface BannedFdcMatchRow {
  composition_id: number;
  normalized_text: string;
  banned_fdc_id: number;
  notification_ref: string;
  notification_date: string | null;
  status: string;
  raw_text: string;
  stated_strengths: number;
  unmatched_strengths: number;
}

export async function findBannedFdcMatches(): Promise<BannedFdcMatch[]> {
  const rows = await db.execute<BannedFdcMatchRow>(sql`
    SELECT
      c.id AS composition_id,
      c.normalized_text,
      bf.id AS banned_fdc_id,
      bf.notification_ref,
      bf.notification_date,
      bf.status,
      bf.raw_text,
      COUNT(*) FILTER (WHERE bfm.strength_mg IS NOT NULL)::int AS stated_strengths,
      COUNT(*) FILTER (
        WHERE bfm.strength_mg IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM composition_molecule cm
          WHERE cm.composition_id = c.id
            AND cm.molecule_id = bfm.molecule_id
            AND cm.strength_unit ILIKE 'mg'
            AND cm.strength_value = bfm.strength_mg
        )
      )::int AS unmatched_strengths
    FROM composition c
    JOIN banned_fdc bf ON bf.molecule_set_hash = c.molecule_set_hash
    JOIN banned_fdc_molecule bfm ON bfm.banned_fdc_id = bf.id
    GROUP BY c.id, c.normalized_text, bf.id, bf.notification_ref, bf.notification_date, bf.status, bf.raw_text
    ORDER BY bf.notification_ref
  `);

  return rows.map((r) => ({
    compositionId: r.composition_id,
    compositionText: r.normalized_text,
    bannedFdcId: r.banned_fdc_id,
    notificationRef: r.notification_ref,
    notificationDate: r.notification_date,
    status: r.status,
    rawText: r.raw_text,
    tier: r.stated_strengths > 0 && r.unmatched_strengths === 0 ? "confirmed" : "candidate",
  }));
}
