import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../src/db";
import { listing, pricePoint, retailer } from "../../../src/db/schema";
import { BrightDataError, runCollector } from "../../../src/ingest/brightdata";
import { closeCollectorRun, openCollectorRun, persistProductBatch } from "../../../src/ingest/persist";
import type { RetailerRunner } from "../../../src/ingest/runners/types";

export const maxDuration = 300;

// Jan Aushadhi is a static government MRP list, not a per-listing page —
// there's nothing live to re-scrape for a single row. Only retailers with a
// real per-product URL are verifiable here.
const VERIFIABLE_RUNNERS: Record<string, () => Promise<RetailerRunner>> = {
  pharmeasy: async () => (await import("../../../src/ingest/runners/pharmeasy")).pharmeasyRunner,
  apollo: async () => (await import("../../../src/ingest/runners/apollo")).apolloRunner,
};

export async function POST(req: NextRequest) {
  let listingId: number | undefined;
  try {
    ({ listingId } = (await req.json()) as { listingId?: number });
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  if (!listingId) return NextResponse.json({ error: "listingId is required" }, { status: 400 });

  const [row] = await db
    .select({
      id: listing.id,
      productUrl: listing.productUrl,
      pincode: listing.pincode,
      retailerId: listing.retailerId,
      retailerSlug: retailer.slug,
    })
    .from(listing)
    .innerJoin(retailer, eq(retailer.id, listing.retailerId))
    .where(eq(listing.id, listingId));

  if (!row) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  const loadRunner = VERIFIABLE_RUNNERS[row.retailerSlug];
  if (!loadRunner) {
    return NextResponse.json(
      { error: `Live verification isn't available for ${row.retailerSlug} — it's a static government price list, not a per-listing page.` },
      { status: 400 },
    );
  }

  const [before] = await db
    .select({ id: pricePoint.id })
    .from(pricePoint)
    .where(eq(pricePoint.listingId, listingId))
    .orderBy(desc(pricePoint.capturedAt))
    .limit(1);

  const runner = await loadRunner();
  const runId = await openCollectorRun(row.retailerId, runner.productCollectorId, 1);

  try {
    const raw = await runCollector(runner.productCollectorId, [{ url: row.productUrl, pincode: row.pincode }]);
    if (raw.length === 0) {
      await closeCollectorRun(runId, "failed", 0);
      return NextResponse.json({ error: "Bright Data returned no rows for this listing." }, { status: 502 });
    }

    const product = runner.normalizeProduct(raw[0]);
    await persistProductBatch({
      runId,
      retailerId: row.retailerId,
      pincode: row.pincode,
      records: [{ raw: raw[0], product }],
      expectedFields: runner.expectedFields,
    });
    await closeCollectorRun(runId, "succeeded", 1);

    const [after] = await db
      .select({ id: pricePoint.id, capturedAt: pricePoint.capturedAt })
      .from(pricePoint)
      .where(eq(pricePoint.listingId, listingId))
      .orderBy(desc(pricePoint.capturedAt))
      .limit(1);

    return NextResponse.json({
      brandName: product.brandName,
      sellingPrice: product.sellingPrice,
      mrp: product.mrp,
      inStock: product.inStock,
      capturedAt: after?.capturedAt.toISOString() ?? null,
      changed: Boolean(after && after.id !== before?.id),
    });
  } catch (err) {
    await closeCollectorRun(runId, "failed", 0);
    const message = err instanceof BrightDataError ? err.message : "Live verification failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
