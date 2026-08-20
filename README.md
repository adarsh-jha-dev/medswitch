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

Postgres tables (`src/db/schema/`) in five groups:

- canonical: `molecule`, `molecule_alias`, `composition`,
  `composition_molecule`, `brand_product`, `composition_parse_cache`,
  `molecule_merge_suggestion`
- marketplace: `retailer`, `listing`, `price_point`, `raw_document`
- ops: `collector_run`, `extraction_issue`, `heal_event`
- banned: `banned_fdc`, `banned_fdc_molecule`
- safety: `safety_chunk`

`pgvector` is enabled on `composition.embedding` for a possible future
fuzzy-similarity suggestion feature; it isn't used on the current match path.
`safety_chunk.embedding` is populated once a safety-text collector exists
(not yet built — see Day 3 cut list below).

## Ingestion

`src/ingest/`, `scripts/ingest.ts`: a Bright Data trigger/poll client, a
transactional batch writer, and one runner file per retailer behind a shared
`RetailerRunner` interface. See `docs/targets.md` for retailer vetting notes
(robots.txt compliance, page structure).

- PharmEasy: 153 listings from product and molecule-page discovery
- Jan Aushadhi (via the public data source `pmbi.co.in`, not the JS-only
  `janaushadhi.gov.in` portal): 214 listings from a 6-term search
- Apollo Pharmacy: 31 listings discovered from `/salt/<slug>` pages, but only
  1 has usable field data as of this writing — see "Apollo Pharmacy
  reliability" below before trusting this number to grow on its own.

`pnpm ingest --retailer=<slug> --refresh-only` re-scrapes listings already in
the DB (no discovery) so `price_point` can pick up drift on a schedule
without spending discovery-collector credits — see Scheduled refresh below.

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

398 listings total across 3 retailers (PharmEasy 153, Jan Aushadhi 214,
Apollo Pharmacy 31). 368 have `raw_composition_text` and are resolved: 311
`auto`, 57 `review`, 0 genuinely `unmatched` (the 30 `unmatched` in
`match_status` are all Apollo listings still missing composition text — see
below, not a matching failure). 36 composition groups have listings from 2+
retailers, unchanged from Day 2 — Apollo hasn't contributed a confirmed
cross-retailer match yet because of the reliability issue below.
`pnpm parse:substitution` prints the cross-retailer price comparisons, for
example:

- Telmisartan 40mg + Amlodipine 5mg: Telma AM at ₹17.09/tablet vs Jan
  Aushadhi at ₹1.51/tablet, 91% cheaper
- Metformin 500mg: Glycomet at ₹1.47/tablet vs Jan Aushadhi at ₹0.62/tablet,
  58% cheaper

Known data-quality gap, left as-is rather than silently patched: a handful
of molecules are duplicated by a genuine source typo in the retailer's own
text (`Metformin Hydrchloride` vs `Metformin Hydrochloride`, `Glimipride`
vs `Glimepiride`, `Chlorthalidon` vs `Chlorthalidone`, `Nimesulid` vs
`Nimesulide`; see `pnpm parse:report`). Trigram similarity now surfaces most
of these as review suggestions (see below) — but not all of them; see the
merge-suggestions section for why.

### Apollo Pharmacy reliability

Both Apollo collectors (`apollo-product`, `apollo-discovery`) extract every
target field correctly when run against a single URL — verified repeatedly.
But under Bright Data's batch mode (many URLs in one job, which is what
normal ingestion uses for speed), most rows come back with the extracted
fields null even though the row itself is returned — first observed at 12
concurrent discovery URLs (1/14 pages populated), confirmed again at product
scrape time (0/12, then 0/19 populated across two full batches). Falling back
to one collector call per URL (`discoveryChunkSize`/`productChunkSize: 1` in
`src/ingest/runners/apollo.ts`) helped at first, but a subsequent refresh
attempt returned degraded results even on a single URL that had worked
moments earlier — consistent with Apollo's own anti-bot/rate-limiting
reacting to the burst of requests generated while iterating on this
collector, not a bug in the extraction logic itself. Every gap is logged
honestly as a real `extraction_issue` row rather than silently dropped.
Net effect: 31 listings discovered, only 1 with usable composition/price
data as of this writing. Re-running `pnpm ingest --retailer=apollo
--refresh-only` after a cooldown should recover the rest — this needs a
retailer that behaves like PharmEasy/Jan Aushadhi under sustained scraping,
which Apollo's anti-bot posture doesn't currently allow for.

### Banned FDC detection

`pnpm banned:ingest` loads the real, complete August 2024 CDSCO tranche — 156
fixed-dose combinations prohibited under S.O.3285(E) through S.O.3440(E), all
dated 12.08.2024 (transcribed verbatim from the Ministry of Health & Family
Welfare gazette PDF, cross-checked against CDSCO's own Gazette Notifications
index). Matching is a two-tier derived join on `composition.molecule_set_hash`
(molecule identity only, no strength) via `src/parse/banned-match.ts` — never
a stored flag, and never a bare "BANNED" claim: every match carries its
notification reference, date, and legal status (`prohibited` /
`unapproved` / `revoked` / `sub_judice`), because FDC prohibitions have real
legal history (the 2016 S.O. 814(E) tranche was quashed by the Delhi High
Court in 2019, appeal still pending — a status column, not a boolean).

Current results (`pnpm parse:report`): **1 confirmed match** — Camylofin
Dihydrochloride 25mg + Paracetamol 300mg, matching banned item S.O.3412(E) at
the exact stated strengths — plus 8 candidate-only matches, including 4
Aceclofenac+Paracetamol compositions (100mg/325mg and 100mg/500mg, both
scraped from PharmEasy) against the banned 50mg/125mg strength — correctly
left as candidates, not confirmed, since the strengths genuinely differ.

### Ops tracking and merge suggestions

`heal_event` (`pnpm heal:log`) logs every Bright Data `scraper heal` call
going forward, with real before/after row counts — 3 logged so far (2 from
Day 1 Jan Aushadhi fixes, 1 from the Apollo product collector). `pnpm
merge:suggestions` runs `pg_trgm` similarity over molecule names and writes
candidates for human review, never auto-merging — 8 pending. The plan's
suggested 0.85 similarity threshold caught none of the real typo duplicates
above (they score 0.75-0.81); 0.7 catches most of them, but not
`Glimepiride`/`Glimipride` (0.44 — an e/i transposition, a case trigram
similarity structurally struggles with on short words), and a threshold low
enough to catch that pulls in clearly-different drugs as noise, so it's left
as a documented gap rather than force-fit.

### Scheduled refresh

`.github/workflows/refresh-prices.yml` re-runs `pnpm ingest --retailer=X
--refresh-only` (product collector only, no discovery) so `price_point` picks
up real price drift over time instead of being a single point. The `cron:`
trigger is **commented out on purpose** — enabling it means the workflow
starts spending Bright Data credits on its own schedule with nobody
watching. It's wired to `workflow_dispatch` only until that's deliberately
turned on. `price_point` is append-on-change by design: if a scheduled run
finds no price movement, that's a working change-detector reporting nothing
changed, not a broken pipeline — don't manufacture history to fill a chart.

## UI (Day 4)

No tRPC — this app is read-mostly and every page is a server-rendered
query, so React Server Components read Drizzle directly via plain async
functions in `src/queries/` (`substitution.ts`, `banned.ts`, `ops.ts`,
`review.ts`), and the three write paths are Next.js server actions
(`app/review/actions.ts`), not an API layer. `scripts/substitution-query.ts`
now calls the same query module the UI does — one source of truth, not two
copies drifting apart. Savings math (`perUnit`, `pctCheaper`, `annualSaving`)
lives in `src/queries/savings.ts` with its own unit tests
(`src/queries/__tests__/savings.test.ts`), since it's the number the whole
demo rests on.

Routes:

- `/` — search by brand name or molecule (plain `ILIKE`, pg_trgm already
  enabled from Day 3 but not used for fuzzy scoring here — a wrong search
  result is harmless since a human picks). A single unambiguous match
  redirects straight to its composition page. Also surfaces the Camylofin
  confirmed banned match and the two best cross-retailer savings, so the
  demo's best material is one click from the homepage.
- `/composition/[fingerprint]` — the payoff page: resolved composition in
  plain terms, a banned-FDC notice (confirmed vs. candidate styled and
  worded differently on purpose), the ranked price table (₹/unit, cheapest
  row emphasized, source URL + capture time per row), the savings callout
  with its assumption stated inline, and a persistent safety line. A
  `review`-status listing that would otherwise be the cheapest is excluded
  from the headline number and shown separately as pending.
- `/safety` — all 9 banned-FDC matches (1 confirmed, 8 candidates), grouped
  by tier, each carrying its notification reference/date/status — the page
  to screenshot for the submission.
- `/pipeline` — the 3 heal events, `collector_run` history, `extraction_issue`
  counts by field/retailer (with the Apollo batch-mode explanation written
  directly on the page, not just here), and per-retailer coverage.
- `/review` — the `review`-status listings and pending
  `molecule_merge_suggestion` rows, each with an approve/reject server
  action. Approving a match sets `verified`; approving a merge repoints
  `composition_molecule`/`banned_fdc_molecule` from the losing molecule to
  the winning one, aliases the losing name, and deletes the losing molecule
  row inside one transaction (verified directly against the DB: Metoprolol /
  S-Metoprolol merged cleanly, 8 `composition_molecule` rows repointed). The
  documented `Glimepiride`/`Glimipride` gap is shown here explicitly rather
  than hidden.

`/pipeline`, `/review`, and `/safety` are `export const dynamic =
"force-dynamic"` — without it Next prerenders them as static at build time
(no dynamic APIs in the render path), which would freeze pipeline/review
state at the last build. `/` and `/composition/[fingerprint]` render
dynamically by default (`searchParams`, uncached DB reads per request).

Design: one accent colour, used only for the cheapest-price emphasis and the
savings number — everything else is a neutral surface/border/muted-text
scale defined once as CSS custom properties (`app/globals.css`) and
registered in Tailwind's `@theme inline` block so `bg-surface`,
`text-muted`, etc. are real utilities, not `[var(--x)]` arbitrary values
sprinkled through every component. `₹/unit` columns use
`font-variant-numeric: tabular-nums` (`.tnum`) so digits align down the
table. No dark-mode toggle (the existing `prefers-color-scheme` support from
create-next-app's scaffold is kept, since it's free), no animations, no
separate landing page — `/` is the search.

See `docs/known-gaps.md` for what building this UI surfaced: the real
cross-retailer composition count (31, not the ~36 estimated in the plan —
Apollo's reliability issue is the reason), a same-brand-different-pack-size
display artifact, and why an approved merge suggestion leaves no
`status = "approved"` row behind.

## Running it

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm ingest --retailer=pharmeasy
pnpm ingest --retailer=janaushadhi
pnpm ingest --retailer=apollo
pnpm parse
pnpm parse:report
pnpm parse:substitution
pnpm banned:ingest
pnpm merge:suggestions
pnpm test
pnpm dev
```

Requires a Postgres database (Neon or Supabase) with the `vector` and
`pg_trgm` extensions enabled, a Bright Data account/API token (billing, promo
code `wemakedevs` for hackathon credit), and an OpenAI API key.

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
`pharmeasy-product`, `pharmeasy-discovery`, `janaushadhi`, `apollo-product`,
`apollo-discovery`. Heal with `npx @brightdata/cli scraper heal <id> "<what
broke>" --url <url>`, or `pnpm heal:log` to log the heal as a `heal_event`
row in the same step.
