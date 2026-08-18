# MedSwitch

Compares Indian pharmacy prices and compositions across retailers, so a
patient on a chronic medication can see a cheaper equivalent. Day 1 ingests
raw listings from two retailers; Day 2 parses composition and matches
equivalent products across them; Day 3+ is UI and fuzzy suggestion.

## What's built (Day 2)

- **Two parsers, not one** (`src/parse/`), matched to the grammar each
  retailer actually uses: PharmEasy's composition strings are rigidly
  structured (`Name(value Unit)+Name(value Unit)`) and parse with a single
  regex (`grammar.ts`) with a coverage check that bails to the LLM rather
  than risk a silent partial parse. Jan Aushadhi's are free text with the
  dose, dosage form, and release modifier all embedded inline, so those go
  to an LLM parser (`llm.ts`, OpenAI, batched 20-at-a-time, structured JSON,
  Zod-validated **per item** — one malformed item no longer nulls out the
  other 19 in its batch, see CLAUDE.md) — cached by hash of the raw string in
  `composition_parse_cache` so a re-run only pays for genuinely new strings.
  Result: 155/367 rows (42%) parsed deterministically with zero LLM calls.
- **Molecule resolution + aliases** (`resolve.ts`, `alias-seed.ts`): exact
  match → alias table → salt-suffix stripping → auto-create. Punctuation is
  stripped during normalization (not just whitespace) so spelling variants
  like `S(-)Amlodipine` / `S-Amlodipine` / `S (-) Amlodipine` collapse to one
  molecule instead of five (see CLAUDE.md heal log).
- **The salt-mismatch safety rule**: when one side of a match states a salt
  form and the other doesn't (e.g. PharmEasy's bare `Diclofenac` vs Jan
  Aushadhi's `Diclofenac Sodium`), the match is allowed but capped at
  `match_confidence = 0.6` and routed to `review` — never auto-matched. When
  both sides state a salt and they differ, they're never matched at all. 55
  of 57 `review` rows are this exact case — a real, populated review queue,
  not a placeholder.
- **Fingerprinting** (`fingerprint.ts`): order-insensitive hash over resolved
  molecule ids + strength + dosage form + release modifier. Deterministic and
  LLM-parsed compositions for the same real drug land on the same hash —
  verified in `__tests__/fingerprint.test.ts` against real Day 1 strings,
  including the two cases that must *not* match (different strength; strength
  + release modifier).
- **Pack size parsing** (`packsize.ts`): `"15 Tablet(s) in Strip"` / `"10's"`
  → `{ count, type }`, turning `sale_price` into a real ₹/unit number.
- **Backfill** (`scripts/parse.ts`): re-runnable — every write is an upsert
  keyed on a stable hash (composition fingerprint, brand_key) or the
  listing's own id. Confidence scoring: 1.00 regex + exact resolution, 0.85
  LLM + exact resolution, capped at 0.60 on any salt mismatch, capped at 0.40
  when dosage form had to be inferred from title text with no structured pack
  field to back it up.
- **Result**: all 367 listings resolved — 310 `auto`, 57 `review`, 0
  `unmatched`. **36 composition groups have listings from both retailers**
  (well above the ~15 needed to demo breadth). `pnpm parse:substitution`
  reproduces the headline comparisons: Telmisartan 40mg+Amlodipine 5mg (Telma
  AM ₹17.09/tablet vs Jan Aushadhi ₹1.51/tablet, 91% cheaper) and Metformin
  500mg (Glycomet ₹1.47/tablet vs Jan Aushadhi ₹0.62/tablet, 58% cheaper).
- **Known data-quality gap, left as-is (not silently "fixed")**: a handful of
  molecules are duplicated by a genuine source typo in the retailer's own
  text — `Metformin Hydrchloride` vs `Metformin Hydrochloride`, `Glimipride`
  vs `Glimepiride`, `Chlorthalidon` vs `Chlorthalidone`, `Nimesulid` vs
  `Nimesulide` (see `pnpm parse:report`). Fixing this needs fuzzy/typo
  tolerance, which is exactly the kind of matching Day 2 deliberately avoided
  doing automatically (embedding similarity could just as easily merge two
  *different* drugs) — candidate for a human-reviewed Day 3 suggestion
  feature on top of the `embedding` column, never on the auto-match path.

## What's built (Day 1)

- **Schema** (`src/db/schema/`): Postgres tables across canonical
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

- No UI — everything so far is schema, CLI ingestion, and CLI parsing/matching.
- No `verified` status yet — nothing has moved a `review` row to `verified`
  by hand; that's a human-in-the-loop step for a future review-queue UI.
- Fuzzy/typo-tolerant molecule matching (see the known data-quality gap
  above) — deliberately deferred to a human-reviewed Day 3 suggestion
  feature, not the auto-match path.
- PharmEasy's `mrp` field needed one heal to appear at all; Jan Aushadhi's
  collector needed two heals (empty results array, then a search box that
  wasn't actually filtering) — see `CLAUDE.md` for what broke and how it was
  fixed, in case either regresses. Day 2 needed its own heals to the parsing
  pipeline itself (molecule-name normalization, LLM batch validation) — also
  logged in `CLAUDE.md`.

## Running it

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL, BRIGHTDATA_API_TOKEN, collector IDs, OPENAI_API_KEY
pnpm db:generate        # only if you change src/db/schema/
pnpm db:migrate
pnpm db:seed
pnpm ingest --retailer=pharmeasy
pnpm ingest --retailer=janaushadhi
pnpm parse               # Day 2: parse + resolve + match all listings (idempotent, re-runnable)
pnpm parse:report        # Step 8: parse method split, unresolved molecules, match status, cross-retailer overlap
pnpm parse:substitution  # Step 7: the actual ₹/unit substitution comparisons
pnpm test                 # vitest — fingerprint/grammar/packsize/units/resolve unit tests
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
