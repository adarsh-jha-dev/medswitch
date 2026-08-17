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
