@AGENTS.md

## Bright Data collectors (Day 1, pinned — reuse these, don't recreate)

```
PHARMEASY_PRODUCT_COLLECTOR=c_msx1mjrr2i7eyw2x5z
PHARMEASY_DISCOVERY_COLLECTOR=c_msx1nb0i2pk3c7ydje
JANAUSHADHI_COLLECTOR=c_msx1nhwk2akso0fxfx
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
