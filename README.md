# MedSwitch

Compares Indian pharmacy prices and compositions across retailers, so a
patient on a chronic medication can see a cheaper equivalent.

## What it does

Ingests product listings from two retailers, parses each retailer's raw
composition text into structured molecule, strength, dosage form, and
release modifier, resolves molecules across retailers (handling synonyms
and salt-form differences), and matches equivalent products by a
composition fingerprint. A substitution query then compares real
price-per-unit across retailers for the same drug.

## Schema

Postgres tables (`src/db/schema/`) in three groups:

- canonical: `molecule`, `molecule_alias`, `composition`,
  `composition_molecule`, `brand_product`, `composition_parse_cache`
- marketplace: `retailer`, `listing`, `price_point`, `raw_document`
- ops: `collector_run`, `extraction_issue`

`pgvector` is enabled on `composition.embedding` for a possible future
fuzzy-similarity suggestion feature; it isn't used on the current match path.

## Ingestion

`src/ingest/`, `scripts/ingest.ts`: a Bright Data trigger/poll client, a
transactional batch writer, and one runner file per retailer behind a shared
`RetailerRunner` interface. See `docs/targets.md` for retailer vetting notes
(robots.txt compliance, page structure).

- PharmEasy: 153 listings from product and molecule-page discovery
- Jan Aushadhi (via the public data source `pmbi.co.in`, not the JS-only
  `janaushadhi.gov.in` portal): 214 listings from a 6-term search

## Parsing and matching

Two parsers (`src/parse/`), matched to the grammar each retailer actually uses:

- PharmEasy's composition strings are rigidly structured
  (`Name(value Unit)+Name(value Unit)`) and parse with a single regex
  (`grammar.ts`), with a coverage check that falls back to the LLM rather
  than risk a silent partial parse.
- Jan Aushadhi's are free text, with the dose, dosage form, and release
  modifier all embedded inline, so those go to an LLM parser (`llm.ts`,
  OpenAI, batched, structured JSON, Zod-validated per item), cached by hash
  of the raw string in `composition_parse_cache` so a re-run only pays for
  genuinely new strings.

155/367 rows (42%) parse deterministically with zero LLM calls.

Molecule resolution (`resolve.ts`, `alias-seed.ts`) tries, in order: exact
match, alias table, salt-suffix stripping, then auto-creates a new molecule
as a last resort. Punctuation is stripped during normalization (not just
whitespace) so spelling variants collapse to one molecule instead of several.

Salt-mismatch rule: when one side of a match states a salt form and the
other doesn't (PharmEasy's bare `Diclofenac` vs Jan Aushadhi's `Diclofenac
Sodium`), the match is allowed but capped at `match_confidence = 0.6` and
routed to `review`, never auto-matched. When both sides state a salt and
they differ, they're never matched at all.

Fingerprinting (`fingerprint.ts`) is an order-insensitive hash over resolved
molecule ids, strength, dosage form, and release modifier, so the same real
drug lands on the same hash regardless of which retailer's grammar produced it.

Pack size parsing (`packsize.ts`) turns strings like `"15 Tablet(s) in
Strip"` or `"10's"` into `{ count, type }`, which is what turns `sale_price`
into a real per-unit number.

The backfill (`scripts/parse.ts`) is re-runnable: every write is an upsert
keyed on a stable hash (composition fingerprint, brand key) or the listing's
own id.

## Current results

367 listings total, every one with a raw_document and non-null
`raw_composition_text`, 0 rows in `extraction_issue`. All 367 are resolved:
310 `auto`, 57 `review`, 0 `unmatched`. 36 composition groups have listings
from both retailers. `pnpm parse:substitution` prints the cross-retailer
price comparisons, for example:

- Telmisartan 40mg + Amlodipine 5mg: Telma AM at ₹17.09/tablet vs Jan
  Aushadhi at ₹1.51/tablet, 91% cheaper
- Metformin 500mg: Glycomet at ₹1.47/tablet vs Jan Aushadhi at ₹0.62/tablet,
  58% cheaper

Known data-quality gap, left as-is rather than silently patched: a handful
of molecules are duplicated by a genuine source typo in the retailer's own
text (`Metformin Hydrchloride` vs `Metformin Hydrochloride`, `Glimipride`
vs `Glimepiride`, `Chlorthalidon` vs `Chlorthalidone`, `Nimesulid` vs
`Nimesulide`; see `pnpm parse:report`). Fixing this needs fuzzy/typo
tolerance, and embedding similarity could just as easily merge two
different drugs, so it stays off the auto-match path.

## Running it

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm ingest --retailer=pharmeasy
pnpm ingest --retailer=janaushadhi
pnpm parse
pnpm parse:report
pnpm parse:substitution
pnpm test
```

Requires a Postgres database (Neon or Supabase) with the `vector` extension
enabled, a Bright Data account/API token (billing, promo code `wemakedevs`
for hackathon credit), and an OpenAI API key.

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
