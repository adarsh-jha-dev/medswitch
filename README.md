# MedSwitch

Compares Indian pharmacy prices and compositions across retailers, so a
patient on a chronic medication can see a cheaper equivalent. Day 1 ingests
raw listings from two retailers; Day 2+ parses composition and matches
equivalent products across them.

## What's built (Day 1)

- **Schema** (`src/db/schema/`): 10 Postgres tables across canonical
  (molecule/composition/brand_product), marketplace (retailer/listing/
  price_point/raw_document), and ops (collector_run/extraction_issue).
  `pgvector` enabled for Day 3 composition matching.
- **Ingestion** (`src/ingest/`, `scripts/ingest.ts`): Bright Data
  trigger→poll client, transactional batch writer, one runner file per
  retailer behind a shared `RetailerRunner` interface.
- **Two retailers scraped**, scoped to antihypertensives, antidiabetics, and
  analgesics, all at Kolkata pincode 700001 (see `docs/targets.md` for the
  full vetting notes — robots.txt compliance, page structure, why these two):
  - **PharmEasy** — 153 listings from product + molecule-page discovery.
  - **Jan Aushadhi** (via the real public data source, `pmbi.co.in`, not the
    JS-only `janaushadhi.gov.in` portal) — 214 listings from a 6-term search.
- **Result**: 367 listings, every one with a raw_document and non-null
  `raw_composition_text`, 0 rows in `extraction_issue`.

## What's not built yet

- Composition parsing / molecule matching across retailers (Day 2).
- `brand_product_id` is null on every listing — no cross-retailer matching yet.
- No UI — everything so far is schema + CLI ingestion.
- PharmEasy's `mrp` field needed one heal to appear at all; Jan Aushadhi's
  collector needed two heals (empty results array, then a search box that
  wasn't actually filtering) — see `CLAUDE.md` for what broke and how it was
  fixed, in case either regresses.

## Running it

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL, BRIGHTDATA_API_TOKEN, collector IDs
pnpm db:generate        # only if you change src/db/schema/
pnpm db:migrate
pnpm db:seed
pnpm ingest --retailer=pharmeasy
pnpm ingest --retailer=janaushadhi
```

Requires a Postgres database (Neon or Supabase) with the `vector` extension
enabled, and a Bright Data account/API token (billing → promo code
`wemakedevs` for hackathon credit).

## Verifying results

```sql
SELECT r.name, COUNT(DISTINCT l.id) AS listings,
       COUNT(DISTINCT rd.id) AS raw_docs,
       COUNT(pp.id) AS price_points
FROM retailer r
LEFT JOIN listing l ON l.retailer_id = r.id
LEFT JOIN raw_document rd ON rd.listing_id = l.id
LEFT JOIN price_point pp ON pp.listing_id = l.id
GROUP BY r.name;

SELECT field_name, COUNT(*) FROM extraction_issue GROUP BY 1 ORDER BY 2 DESC;
```

## Bright Data collectors

Pinned in `.env` / `CLAUDE.md` so they get reused rather than recreated:
`pharmeasy-product`, `pharmeasy-discovery`, `janaushadhi`. Heal with
`npx @brightdata/cli scraper heal <id> "<what broke>" --url <url>`.
