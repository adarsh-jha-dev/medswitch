@AGENTS.md

## Bright Data collectors (Day 1, pinned — reuse these, don't recreate)

```
PHARMEASY_PRODUCT_COLLECTOR=c_msx1mjrr2i7eyw2x5z
PHARMEASY_DISCOVERY_COLLECTOR=c_msx1nb0i2pk3c7ydje
JANAUSHADHI_COLLECTOR=c_msx1nhwk2akso0fxfx
APOLLO_PRODUCT_COLLECTOR=c_mszko0ud1xsm59ukxx
APOLLO_DISCOVERY_COLLECTOR=c_mszknz6613hk4ip27m
```

Run:  `npx @brightdata/cli scraper run $ID <url> --pretty`
Heal: `npx @brightdata/cli scraper heal $ID "<what broke>" --url <url>`

Same IDs also live in `.env` (`PHARMEASY_PRODUCT_COLLECTOR` etc., read by
`src/ingest/collector-ids.ts`) — that's what the ingestion code actually uses.
This block is just so an agent session reuses them instead of recreating.

Jan Aushadhi's collector required two heals after creation: one to stop the
`results` array coming back empty on every row (fields needed to be flat
top-level, not nested), and one to make the search box actually filter
(it was silently returning ~1450 unrelated rows instead of the ~77 matching
each generic name). Both are confirmed fixed — verified 77/77 rows matching
on a Metformin search and correct per-term counts on a 2-term batch run.

## Day 2 parsing pipeline — LLM provider is OpenAI, not Anthropic

`src/parse/llm.ts` calls OpenAI (`OPENAI_API_KEY` / `OPENAI_MODEL` in `.env`,
default `gpt-4o-mini`), by explicit user choice — not Anthropic. Don't
reintroduce `@anthropic-ai/sdk` here without asking first.

Two heals needed after the first backfill runs (`pnpm parse`), both fixed and
re-verified with a full clean re-run (367/367 listings resolved, 0 `unmatched`):

1. **Molecule-name normalization stripped whitespace but not punctuation.**
   Five raw spellings of the same drug — `S(-)Amlodipine`, `S- Amlodipine`,
   `S (-) Amlodipine`, `S(-) Amlodipine`, `S-Amlodipine` — each auto-created
   their own `molecule` row instead of resolving to one. Fixed by replacing
   (not stripping) non-alphanumeric characters with a space before collapsing
   whitespace, so all five now normalize to `"s amlodipine"`. This also broke
   the `"Paracetamol / Acetaminophen"` slash-split fallback in `resolve.ts`,
   which was checking the *normalized* string for `/` — normalization now
   strips it, so that check moved to the raw string. Regression test:
   `src/parse/__tests__/resolve.test.ts`.
2. **One malformed LLM item nulled 19 good parses in the same batch.**
   `Trypsin-Chymotrypsin` doses in "AU" (Anson Units), which wasn't in the
   `strengthUnit` enum — validating the whole 20-item batch response as one
   Zod schema meant that single invalid unit failed the entire batch, caching
   all 20 as parse failures. Fixed two ways: `strengthUnit` is no longer a
   closed enum (real Indian pharmacy labels use units beyond mg/ml/%,
   `toCanonical()` already passes unrecognized units through unchanged), and
   each item in a batch is now validated individually so one bad item can't
   poison the rest.

If `pnpm parse` reports `unmatched > 0` or the "newly created molecules" list
in `pnpm parse:report` shows near-duplicate spellings of the same drug, check
`composition_parse_cache` for `parsed IS NULL` rows first — clearing those and
re-running is safe and idempotent (LLM cost is only paid for genuine cache misses).

## Day 3 — third retailer, banned-FDC detection, heal_event, merge suggestions

Apollo Pharmacy added as retailer #3 (`src/ingest/runners/apollo.ts`), same
pincode 700001, same 6 seed molecules — discovery via `/salt/<slug>` pages,
which resolve in both `lowercase-hyphenated` and `UPPERCASE+plus-joined`
forms (both real, confirmed live). Server-rendered Next.js pages like
PharmEasy, so the same collector pattern applies.

`apollo-product`'s AI-generated collector only extracted `product_name` and
`availability_status` on first pass. One heal reported "done" but genuinely
changed nothing on re-verification (logged as a real heal_event anyway — a
heal that didn't take is still evidence, not something to quietly retry and
forget). A second, more explicit heal (naming the exact target keys:
`composition`, `manufacturer`, `mrp`, `selling_price`, `pack_size`) fixed it —
verified all 7 fields present on a re-run against the Telma-AM page.

Retried `pnpm ingest --retailer=apollo --refresh-only` again later (still
only 1/31 Apollo listings usable) — confirmed directly via `scraper run`
against a known-good listing URL, bypassing the ingest pipeline entirely,
that the collector currently returns almost nothing (`{"input": {"url": ...}}`,
sometimes with `availability_status`, no `product_name`/`composition`/price
fields at all). Not a regression in the collector's extraction logic — it's
still the healed collector from above — and not a pipeline bug either, since
this reproduces with a bare `scraper run` call outside our code. Consistent
with Apollo's anti-bot posture blocking the collector outright rather than
degrading its extraction. Don't keep retrying this back-to-back — it burns
Bright Data credits for the same null result; worth trying again after a
longer cooldown (hours, not minutes), not by re-healing.

`heal_event` (`ops.ts`) logs every Bright Data heal from now on —
`scripts/heal-log.ts` (`pnpm heal:log`) wraps `scraper heal` so this happens
automatically instead of being reconstructed from memory later. Backfilled
the two Day 1 Jan Aushadhi heals via `scripts/backfill-heal-events.ts`
(no other Bright Data heals are documented anywhere in the repo — don't
invent a third one if asked to "backfill the known heals").

**Banned-FDC detection** (`src/db/schema/banned.ts`, `src/parse/banned-*.ts`):
`composition.molecule_set_hash` (sha256 of sorted molecule ids only, no
strength/dosage form) is the join key against `banned_fdc.molecule_set_hash`,
computed the same way. The full, real August 2024 CDSCO tranche — 156 FDCs,
S.O.3285(E) through S.O.3440(E), all dated 12.08.2024 — is transcribed
verbatim in `src/parse/banned-fdc-data.ts` (sourced from the Ministry of
Health & Family Welfare gazette PDF referenced by India TV's coverage, and
cross-checked against CDSCO's own Gazette Notifications index, which lists
the same S.O. range under "Prohibition of 156 FDCs"). `pnpm banned:ingest` is
idempotent (upserts on `notification_ref`). Matching is a derived join
(`src/parse/banned-match.ts`), never a stored flag — two tiers, reported
separately: `molecule_set_hash` equality alone is a **candidate**; promoted
to **confirmed** only when the notification states strengths and every one
matches a `composition_molecule` row exactly. A notification that never
states a strength stays a candidate forever, by design.

Real result, not a demo fabrication: 9 matches total. The DB already had 7
scraped Aceclofenac+Paracetamol compositions (from PharmEasy's
`aceclofenac-paracetamol-acetaminophen` discovery page) at 100mg/325mg and
100mg/500mg — all **candidates** against banned items S.O.3408(E)/S.O.3409(E)
("Aceclofenac 50mg + Paracetamol 125mg", oral liquid/tablet), never
confirmed, since none match the banned strengths exactly — the correct,
honest outcome. But one composition, **Camylofin Dihydrochloride 25mg +
Paracetamol 300mg (tablet)**, matches banned item S.O.3412(E) at the *exact*
stated strengths — a genuine **confirmed** hit.

Debugging note: the first version of this query used `COUNT(*) FILTER (...)`
without casting, and every case reported "candidate" even when the underlying
join proved an exact match. Cause: Postgres `COUNT` returns `bigint`, which
the `postgres` driver serializes as a JS **string** ("0", "2"), so
`unmatched_strengths === 0` was comparing `"0" === 0` — always false. Fixed
with `::int` casts in the SQL (the same pattern already used elsewhere in
`parse-report.ts`). Worth remembering for any future aggregate query here.

**Trigram merge suggestions** (`scripts/merge-suggestions.ts`,
`pnpm merge:suggestions`, `pg_trgm`): the plan's suggested 0.85 similarity
threshold caught nothing real — actual typo duplicates in the DB score
0.75-0.81 (`"Metformin Hydrochloride"` vs `"Metformin Hydrchloride"` = 0.808).
Threshold is 0.7. This still misses `"Glimepiride"` vs `"Glimipride"`
(0.4375, an e/i transposition) — trigram similarity structurally struggles
with short-word transpositions, and a threshold low enough to catch it pulls
in clearly-different drugs (`"Gliclazide"`/`"Glipizide"` at 0.40) as noise.
Documented as a known gap, same spirit as the README's existing typo-dup note.

The GitHub Actions cron for scheduled refreshes
(`.github/workflows/refresh-prices.yml`) is **intentionally left on
`workflow_dispatch` only** — the `schedule:` trigger is commented out because
enabling it means the workflow starts spending Bright Data credits on its own
with nobody watching. Uncomment it deliberately, not as a side effect of
touching the file.

## Day 5 — agent (`/ask`, `/scan`), banned-FDC embeddings

`safety_chunk` stays empty **on purpose**, permanently, not just deferred —
building a safety-text collector and retrieving over uses/side-effects/
warnings would push MedSwitch into giving medical information, which is the
line this project stays behind. `banned_fdc.rawText` (156 CDSCO gazette
notifications, already in the DB from Day 3) got `embedding vector(1536)`
instead — one embedding per row, no chunking needed, backfilled via `pnpm
banned:embed` (`scripts/embed-banned-fdc.ts`). If asked to "add the safety
corpus" later, that's a deliberate reversal of a Day 5 decision, not a gap —
confirm with the user before building it.

**Every OpenAI model used across this repo — parsing, embeddings, the
agent, and prescription-photo vision — is the cheap tier**: `gpt-4o-mini`
(chat + vision, `OPENAI_MODEL` / `OPENAI_AGENT_MODEL` / `OPENAI_VISION_MODEL`,
all default to `gpt-4o-mini`) and `text-embedding-3-small`. Don't upgrade
any of these to a larger model (`gpt-4o`, `gpt-4-turbo`, `o1`, etc.) without
asking first — this was an explicit user constraint for Day 5, not just an
existing default worth preserving.

The agent (`src/agent/`) gets exactly three tools
(`find_substitutes`, `check_banned`, `search_notifications`,
`src/agent/tools.ts`) wrapping `src/queries/` — **no raw SQL access**, so it
physically cannot cross a composition boundary or invent a price. Two real
bugs found only by testing the actual HTTP surface (direct function calls in
isolation didn't catch either — worth remembering for any future agent
work here):

1. `find_substitutes`'s `brandOrMolecule` param is a substring ILIKE search
   (via `resolveSubstitutionGroup()` → `searchProducts()`), so passing a
   full composition string (`"Telmisartan 40mg + Amlodipine 5mg (tablet)"`)
   as the query can never match — it's longer than any single brand/molecule
   field. Fixed by giving `find_substitutes` (and `check_banned`, which
   already took one) an optional `compositionFingerprint` param for exact
   lookups, and having `/ask?fingerprint=...` seed the model with both the
   fingerprint and the human-readable composition text.
2. Before that fix, a fingerprint-only seed message caused the model to pass
   the raw fingerprint hash itself as `brandOrMolecule` (its only string to
   work with), which silently found nothing. Root cause was the same as #1;
   noted separately because it's the symptom that surfaced it.

Both `find_substitutes` and the `/scan` resolver share
`resolveSubstitutionGroup()` = `searchProducts()[0]` — first ILIKE match,
not best-ranked. This pre-existing gap (not introduced today) is now
user-visible through the agent: e.g. a scanned "Glycomet 500mg" resolved to
an unrelated combination product whose brand name happened to contain
"Glycomet" as a substring. The agent's guardrails handled it honestly (it
stated the mismatch rather than hiding it) — logged in `docs/known-gaps.md`
(Day 5 section) rather than fixed, since a real fix touches the
human-facing `/` search too.

`src/agent/__tests__/refusal.test.ts` (`pnpm test:agent`, run separately
from `pnpm test` since it hits the live OpenAI API and DB) is the adversarial
eval — 13 prompts, asserting refusal/scoping behavior, not exact wording.
**13/13 passing.** Two early failures were bad regexes in the test itself,
not agent misbehavior (the model correctly said "could not find" — test
expected "couldn't find"; the model correctly deferred with "I recommend
discussing this with your doctor" — test's `/i recommend/` regex was too
broad and caught its own deferral phrasing). Worth checking the assertion
before assuming a red refusal-eval test means the agent regressed.

MCP server (the plan's Step 6) was **cut, not built** — first in the plan's
own explicit cut order, even though it would've been cheap (the tools
already exist). Don't build it without asking first; if asked to add it
later, it's new scope, not a gap being closed.
