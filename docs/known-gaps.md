# Day 4 known gaps

Found while building the UI (`app/`, `src/queries/`, `src/components/`). Per
the Day 4 plan's own instruction, none of these were fixed today — logged
here, revisit only if worth the churn.

## 1. Real cross-retailer group count is lower than planned

Step 1 of the plan asked to run this query before designing anything, and
expect ~36:

```sql
SELECT COUNT(*) FROM (
  SELECT c.id
  FROM composition c
  JOIN brand_product bp ON bp.composition_id = c.id
  JOIN listing l ON l.brand_product_id = bp.id
  WHERE l.match_status IN ('auto','verified') AND bp.pack_unit_count IS NOT NULL
  GROUP BY c.id HAVING COUNT(DISTINCT l.retailer_id) >= 2
) t;
```

Actual result at the start of Day 4: **31**, not 36. Root cause: Apollo
Pharmacy (retailer #3) has only 1 listing with usable `pack_unit_count`/price
data — the reliability issue already documented in CLAUDE.md/README (batch
extraction returning null fields under Bright Data's anti-bot posture) — so
it never supplies a second retailer to any composition group. The 36 in the
plan was presumably estimated before that reliability issue was confirmed at
its current severity.

Widened the browse surface per the plan's suggestion: 12 more compositions
have 2+ brands at a single retailer (mostly PharmEasy), bringing the total
`listSubstitutionGroups()` count to 43. (It reads 44 in a fresh run today —
one review-status listing crossed the 2-retailer/2-brand threshold when it
was approved to `verified` during Step 8's real functional test of the
review actions, not a data change from anything in this list.)

## 2. Same brand, two pack sizes, shown as two table rows — ANNOTATED

`brand_key` (in `src/parse/persist.ts`) is a hash of name + manufacturer +
composition + **pack size**, so the same real product at two pack sizes
(e.g. "Telma 20 Tablet" as a 15-strip and a 30-strip) becomes two distinct
`brand_product` rows and therefore two rows in the composition page's price
table — both under the same brand name. Correct data (both listings are
real and priced independently), but read oddly in the ranked table without
an explicit "same brand, different pack" annotation. Observed in the
`Telmisartan 20mg` group (`Telma 20 Tablet` at ₹92.70/30 and ₹48.81/15).

**Annotated** (not deduplicated — the underlying two-row structure is still
correct data, and the ₹/unit column already makes the comparison correct):
`PriceTable` (`src/components/price-table.tsx`) now groups ranked listings by
`retailer + brandName` and adds a "same brand, different pack" note under the
pack size whenever a brand appears more than once for the same retailer,
verified against the real `Telmisartan 20mg` / `Telma 20 Tablet` case.

## 3. Approved merges leave no audit trail

`molecule_merge_suggestion.molecule_a_id` / `molecule_b_id` are both
`onDelete: "cascade"` against `molecule.id`. `approveMerge()`
(`app/review/actions.ts`) deletes molecule B as its last step, which cascades
and removes the suggestion row itself — there's nothing left to mark
`status = "approved"` on afterward. Confirmed via direct testing: the
suggestion row for the Metoprolol / S-Metoprolol merge (id 1) is gone after
approval, not present with `status = 'approved'`. Functionally correct (it
disappears from the pending queue either way, and `composition_molecule` /
`banned_fdc_molecule` are correctly repointed to the surviving molecule —
also verified directly), but it means there's no queryable history of what's
been approved, only what's been rejected (`rejectMerge` sets
`status = 'rejected'` and that row survives, since neither molecule is
deleted). This is the schema's own design (the cascade predates Day 4), not
an oversight introduced today — flagged here rather than silently
worked around with a schema change mid-build.

## 4. Existing gaps, now visible in the UI

Already documented in README/CLAUDE.md, now surfaced directly rather than
only in `pnpm parse:report` output:

- `Glimepiride` vs `Glimipride` (0.44 trigram similarity) never appears in
  the `/review` merge queue — shown there as an explicit documented miss.
- Apollo Pharmacy's extraction issues are explained directly on `/pipeline`,
  not just in the README.

# Day 5 known gaps

Found while building the agent (`src/agent/`), `/ask`, and `/scan`. Per the
Day 4 list's own precedent, logged rather than fixed today — the agent's
tool calls go through the exact same `resolveSubstitutionGroup()` /
`searchProducts()` path the human-facing `/` search already used, so these
are pre-existing data-layer gaps the new agent surface makes visible, not
bugs introduced by it.

## 1. `resolveSubstitutionGroup()` takes the first ILIKE match, not the best one — FIXED

`find_substitutes` and the `/scan` resolver both call
`resolveSubstitutionGroup(query)`, which was `searchProducts(query)[0]` —
first result, no relevance ranking. A plain-text query like `"Metformin"` or
`"Glycomet"` could resolve to a combination product whose brand name happens
to contain the query as a substring (e.g. `"Glycomet GP 2/850mg"`) instead
of the plain single-molecule product the user meant. Observed directly: a
scanned line reading `"Glycomet 500mg"` resolved to `"Glimepiride 2mg +
Metformin Hydrochloride 850mg"`. The agent's own system-prompt guardrails
handled this honestly in both surfaces — it stated the mismatch explicitly
rather than presenting it as the requested drug — so the failure mode was a
wrong match surfaced transparently, not a wrong match presented as right.

**Fixed**: `searchProducts()` now ranks every candidate (`rankSearchCandidates()`
in `src/queries/substitution.ts`) instead of returning DB row order — exact
normalized match beats prefix beats substring; within a tier, a
single-molecule composition beats a combination, then cross-retailer price
coverage, then name length break remaining ties. Also widened the pre-rank
candidate fetch from 20 to 200 rows, since the old cap could truncate the
best match out of an arbitrarily-ordered result set before ranking ever saw
it. `"Glycomet"` and `"Metformin"` now resolve to the plain single-molecule
product; regression test in `src/queries/__tests__/substitution.test.ts`.

## 2. `check_banned` and `find_substitutes` both require a fingerprint or a short name

`find_substitutes`'s `brandOrMolecule` parameter is a substring search, so a
full composition string (e.g. `"Telmisartan 40mg + Amlodipine 5mg
(tablet)"`) can never match — it's longer than any single brand or molecule
field. Fixed for the seeded case (`/ask?fingerprint=...` now also passes the
composition's `normalizedText`, and both tools accept a
`compositionFingerprint` directly instead of requiring a name), but a
freestanding question that names a composition by its full descriptive
string rather than a brand/molecule name will still miss. Not expected to
come up often in practice — real questions use brand or molecule names —
but noted here rather than silently working around it with fuzzier matching.
