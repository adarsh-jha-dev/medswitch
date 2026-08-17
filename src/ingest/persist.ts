import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { collectorRun, extractionIssue, listing, pricePoint, rawDocument } from "../db/schema";
import type { ExtractedProduct } from "./runners/types";

export async function openCollectorRun(retailerId: number, collectorId: string, rowsExpected: number) {
  const [run] = await db
    .insert(collectorRun)
    .values({ retailerId, collectorId, status: "running", rowsExpected })
    .returning({ id: collectorRun.id });
  return run.id;
}

export async function closeCollectorRun(runId: number, status: "succeeded" | "failed" | "partial", rowsReturned: number) {
  await db
    .update(collectorRun)
    .set({ status, rowsReturned, finishedAt: new Date() })
    .where(eq(collectorRun.id, runId));
}

const ALL_FIELDS: Array<keyof ExtractedProduct> = [
  "brandName",
  "manufacturer",
  "rawCompositionText",
  "packSize",
  "mrp",
  "sellingPrice",
  "inStock",
];

// Single transaction per batch so a mid-batch crash doesn't leave half-written state.
export async function persistProductBatch(params: {
  runId: number;
  retailerId: number;
  pincode: string;
  records: Array<{ raw: unknown; product: ExtractedProduct }>;
  expectedFields?: Array<keyof ExtractedProduct>;
}): Promise<void> {
  const { runId, retailerId, pincode, records, expectedFields = ALL_FIELDS } = params;

  await db.transaction(async (tx) => {
    for (const { raw, product } of records) {
      const rawJson = JSON.stringify(raw);
      const contentHash = createHash("sha256").update(rawJson).digest("hex");

      const [listingRow] = await tx
        .insert(listing)
        .values({
          retailerId,
          retailerSku: product.retailerSku,
          productUrl: product.sourceUrl,
          rawTitle: product.brandName,
          rawCompositionText: product.rawCompositionText,
          rawManufacturer: product.manufacturer,
          rawPackSize: product.packSize,
          pincode,
        })
        .onConflictDoUpdate({
          target: [listing.retailerId, listing.retailerSku],
          set: {
            rawTitle: product.brandName,
            rawCompositionText: product.rawCompositionText,
            rawManufacturer: product.manufacturer,
            rawPackSize: product.packSize,
            lastSeenAt: new Date(),
          },
        })
        .returning({ id: listing.id });

      await tx.insert(rawDocument).values({
        listingId: listingRow.id,
        collectorRunId: runId,
        body: gzipSync(rawJson),
        contentHash,
      });

      const [latest] = await tx
        .select({ salePrice: pricePoint.salePrice, inStock: pricePoint.inStock })
        .from(pricePoint)
        .where(and(eq(pricePoint.listingId, listingRow.id)))
        .orderBy(desc(pricePoint.capturedAt))
        .limit(1);

      const latestSalePrice = latest?.salePrice === null || latest?.salePrice === undefined ? null : Number(latest.salePrice);
      const hasChanged =
        !latest || latestSalePrice !== product.sellingPrice || latest.inStock !== product.inStock;

      if (hasChanged) {
        await tx.insert(pricePoint).values({
          listingId: listingRow.id,
          collectorRunId: runId,
          mrp: product.mrp !== null ? String(product.mrp) : null,
          salePrice: product.sellingPrice !== null ? String(product.sellingPrice) : null,
          inStock: product.inStock,
          pincode,
        });
      }

      for (const field of expectedFields) {
        const value = product[field];
        if (value === null || value === "") {
          await tx.insert(extractionIssue).values({
            listingId: listingRow.id,
            collectorRunId: runId,
            fieldName: field,
          });
        }
      }
    }
  });
}
