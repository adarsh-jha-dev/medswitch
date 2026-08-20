import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { collectorRun, healEvent, retailer } from "../db/schema";

export interface CollectorRunSummary {
  id: number;
  retailer: string;
  collectorId: string;
  status: string;
  rowsExpected: number;
  rowsReturned: number;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
}

export async function collectorRuns(): Promise<CollectorRunSummary[]> {
  const rows = await db
    .select({
      id: collectorRun.id,
      retailer: retailer.name,
      collectorId: collectorRun.collectorId,
      status: collectorRun.status,
      rowsExpected: collectorRun.rowsExpected,
      rowsReturned: collectorRun.rowsReturned,
      startedAt: collectorRun.startedAt,
      finishedAt: collectorRun.finishedAt,
    })
    .from(collectorRun)
    .innerJoin(retailer, eq(retailer.id, collectorRun.retailerId))
    .orderBy(desc(collectorRun.startedAt));

  return rows.map((r) => ({
    ...r,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    durationSeconds: r.finishedAt ? Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000) : null,
  }));
}

export interface HealEventSummary {
  id: number;
  retailer: string | null;
  collectorId: string;
  fieldName: string | null;
  symptom: string;
  healPrompt: string;
  rowsBefore: number | null;
  rowsAfter: number | null;
  detectedAt: string;
  healedAt: string | null;
}

export async function healEvents(): Promise<HealEventSummary[]> {
  const rows = await db
    .select({
      id: healEvent.id,
      retailer: retailer.name,
      collectorId: healEvent.collectorId,
      fieldName: healEvent.fieldName,
      symptom: healEvent.symptom,
      healPrompt: healEvent.healPrompt,
      rowsBefore: healEvent.rowsBefore,
      rowsAfter: healEvent.rowsAfter,
      detectedAt: healEvent.detectedAt,
      healedAt: healEvent.healedAt,
    })
    .from(healEvent)
    .leftJoin(retailer, eq(retailer.id, healEvent.retailerId))
    .orderBy(desc(healEvent.detectedAt));

  return rows.map((r) => ({
    ...r,
    detectedAt: r.detectedAt.toISOString(),
    healedAt: r.healedAt ? r.healedAt.toISOString() : null,
  }));
}

export interface ExtractionIssueGroup {
  retailer: string;
  fieldName: string;
  count: number;
  sampleNote: string | null;
}

export async function extractionIssuesByFieldAndRetailer(): Promise<ExtractionIssueGroup[]> {
  const rows = await db.execute<{ retailer: string; field_name: string; count: number; sample_note: string | null }>(sql`
    SELECT r.name AS retailer, ei.field_name, COUNT(*)::int AS count,
      (array_agg(ei.note) FILTER (WHERE ei.note IS NOT NULL))[1] AS sample_note
    FROM extraction_issue ei
    JOIN listing l ON l.id = ei.listing_id
    JOIN retailer r ON r.id = l.retailer_id
    GROUP BY r.name, ei.field_name
    ORDER BY count DESC
  `);
  return rows.map((r) => ({ retailer: r.retailer, fieldName: r.field_name, count: r.count, sampleNote: r.sample_note }));
}

export interface RetailerCoverage {
  retailer: string;
  listings: number;
  withComposition: number;
  matchStatusCounts: Record<string, number>;
}

export async function retailerCoverage(): Promise<RetailerCoverage[]> {
  const totals = await db.execute<{ retailer: string; listings: number; with_composition: number }>(sql`
    SELECT r.name AS retailer, COUNT(l.id)::int AS listings,
      COUNT(*) FILTER (WHERE l.raw_composition_text IS NOT NULL)::int AS with_composition
    FROM retailer r
    LEFT JOIN listing l ON l.retailer_id = r.id
    GROUP BY r.name
    ORDER BY listings DESC
  `);

  const statusRows = await db.execute<{ retailer: string; status: string; count: number }>(sql`
    SELECT r.name AS retailer, l.match_status AS status, COUNT(*)::int AS count
    FROM listing l
    JOIN retailer r ON r.id = l.retailer_id
    GROUP BY r.name, l.match_status
  `);

  const statusByRetailer = new Map<string, Record<string, number>>();
  for (const row of statusRows) {
    if (!statusByRetailer.has(row.retailer)) statusByRetailer.set(row.retailer, {});
    statusByRetailer.get(row.retailer)![row.status] = row.count;
  }

  return totals.map((t) => ({
    retailer: t.retailer,
    listings: t.listings,
    withComposition: t.with_composition,
    matchStatusCounts: statusByRetailer.get(t.retailer) ?? {},
  }));
}
