import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { listing, retailer } from "../src/db/schema";
import { runCollector } from "../src/ingest/brightdata";
import { closeCollectorRun, openCollectorRun, persistProductBatch } from "../src/ingest/persist";
import type { RetailerRunner } from "../src/ingest/runners/types";

const BATCH_SIZE = 50;

const RUNNERS: Record<string, () => Promise<RetailerRunner>> = {
  janaushadhi: async () => (await import("../src/ingest/runners/janaushadhi")).janaushadhiRunner,
  pharmeasy: async () => (await import("../src/ingest/runners/pharmeasy")).pharmeasyRunner,
  apollo: async () => (await import("../src/ingest/runners/apollo")).apolloRunner,
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function discoverUrls(runner: RetailerRunner): Promise<string[]> {
  const pages = runner.discoveryUrls();
  const urls = new Set<string>();
  for (const batch of chunk(pages, runner.discoveryChunkSize ?? 50)) {
    const raw = await runCollector(runner.discoveryCollectorId, batch);
    for (const record of raw) {
      for (const discovered of runner.normalizeDiscovery(record)) {
        urls.add(discovered.url);
      }
    }
  }
  return [...urls];
}

async function ingestProducts(runner: RetailerRunner, urls: string[], retailerId: number, pincode: string) {
  for (const batch of chunk(urls, runner.productChunkSize ?? BATCH_SIZE)) {
    const runId = await openCollectorRun(retailerId, runner.productCollectorId, batch.length);
    try {
      const raw = await runCollector(runner.productCollectorId, batch);
      const records = raw.map((r) => ({ raw: r, product: runner.normalizeProduct(r) }));
      await persistProductBatch({ runId, retailerId, pincode, records, expectedFields: runner.expectedFields });
      await closeCollectorRun(runId, records.length === batch.length ? "succeeded" : "partial", records.length);
      console.log(`[${runner.retailerSlug}] batch of ${batch.length} -> ${records.length} rows persisted`);
    } catch (err) {
      await closeCollectorRun(runId, "failed", 0);
      console.error(`[${runner.retailerSlug}] batch failed:`, err);
    }
  }
}

async function ingestSinglePhase(runner: RetailerRunner, retailerId: number, pincode: string) {
  if (!runner.expandSinglePhase) throw new Error(`${runner.retailerSlug}: singlePhase runner needs expandSinglePhase`);
  const expand = runner.expandSinglePhase;

  const seeds = runner.discoveryUrls();
  for (const batch of chunk(seeds, BATCH_SIZE)) {
    const runId = await openCollectorRun(retailerId, runner.discoveryCollectorId, batch.length);
    try {
      const raw = await runCollector(runner.discoveryCollectorId, batch);
      const records = raw.flatMap((r) => expand(r).map((product) => ({ raw: r, product })));
      await persistProductBatch({ runId, retailerId, pincode, records, expectedFields: runner.expectedFields });
      await closeCollectorRun(runId, "succeeded", records.length);
      console.log(`[${runner.retailerSlug}] batch of ${batch.length} seeds -> ${records.length} rows persisted`);
    } catch (err) {
      await closeCollectorRun(runId, "failed", 0);
      console.error(`[${runner.retailerSlug}] batch failed:`, err);
    }
  }
}

async function ingestRefreshOnly(runner: RetailerRunner, retailerId: number, pincode: string) {
  if (runner.singlePhase) {
    // Jan Aushadhi's product page IS the search results — expandSinglePhase
    // already re-derives everything fresh each run, and PMBI's list is a
    // fixed nationwide MRP cap that rarely moves, so a separate refresh mode
    // adds nothing here.
    throw new Error(`${runner.retailerSlug} is singlePhase — refresh-only isn't meaningful, just run without --refresh-only`);
  }
  const existing = await db
    .select({ productUrl: listing.productUrl })
    .from(listing)
    .where(eq(listing.retailerId, retailerId));
  const urls = existing.map((r) => r.productUrl);
  console.log(`[${runner.retailerSlug}] refresh-only: re-running product collector over ${urls.length} known listings...`);
  await ingestProducts(runner, urls, retailerId, pincode);
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--retailer="));
  const slug = arg?.split("=")[1];
  if (!slug || !RUNNERS[slug]) {
    console.error(`Usage: pnpm ingest --retailer=<${Object.keys(RUNNERS).join("|")}> [--refresh-only]`);
    process.exit(1);
  }
  const refreshOnly = process.argv.includes("--refresh-only");

  const pincode = process.env.SCRAPE_PINCODE;
  if (!pincode) throw new Error("SCRAPE_PINCODE is not set");

  const runner = await RUNNERS[slug]();

  const [retailerRow] = await db
    .select({ id: retailer.id })
    .from(retailer)
    .where(eq(retailer.slug, runner.retailerSlug));
  if (!retailerRow) throw new Error(`retailer '${runner.retailerSlug}' not seeded — run pnpm db:seed first`);

  if (refreshOnly) {
    // No discovery — re-scrape listings we already have so price_point picks
    // up drift without spending discovery-collector credits on a schedule.
    await ingestRefreshOnly(runner, retailerRow.id, pincode);
  } else if (runner.singlePhase) {
    console.log(`[${runner.retailerSlug}] single-phase ingest (discovery rows are product rows)...`);
    await ingestSinglePhase(runner, retailerRow.id, pincode);
  } else {
    console.log(`[${runner.retailerSlug}] discovering product URLs...`);
    const urls = await discoverUrls(runner);
    console.log(`[${runner.retailerSlug}] discovered ${urls.length} URLs, ingesting...`);
    await ingestProducts(runner, urls, retailerRow.id, pincode);
  }
  console.log(`[${runner.retailerSlug}] done.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
