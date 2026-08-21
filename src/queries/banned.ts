import { sql } from "drizzle-orm";
import { db } from "../db";
import { embedText } from "../parse/embed";
import { findBannedFdcMatches, type BannedFdcMatch } from "../parse/banned-match";

export { findBannedFdcMatches, type BannedFdcMatch };

export interface NotificationSearchResult {
  notificationRef: string;
  notificationDate: string | null;
  status: string;
  rawText: string;
  sourceUrl: string | null;
}

// pgvector cosine distance over banned_fdc.embedding — regulatory text only, never safety/clinical text.
export async function searchBannedNotifications(query: string, limit = 5): Promise<NotificationSearchResult[]> {
  const embedding = await embedText(query);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const rows = await db.execute<{
    notification_ref: string;
    notification_date: string | null;
    status: string;
    raw_text: string;
    source_url: string | null;
  }>(sql`
    SELECT notification_ref, notification_date, status, raw_text, source_url
    FROM banned_fdc
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    notificationRef: r.notification_ref,
    notificationDate: r.notification_date,
    status: r.status,
    rawText: r.raw_text,
    sourceUrl: r.source_url,
  }));
}

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
