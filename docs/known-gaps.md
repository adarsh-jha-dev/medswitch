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

## 2. Same brand, two pack sizes, shown as two table rows

`brand_key` (in `src/parse/persist.ts`) is a hash of name + manufacturer +
composition + **pack size**, so the same real product at two pack sizes
(e.g. "Telma 20 Tablet" as a 15-strip and a 30-strip) becomes two distinct
`brand_product` rows and therefore two rows in the composition page's price
table — both under the same brand name. Correct data (both listings are
real and priced independently), but reads oddly in the ranked table without
an explicit "same brand, different pack" annotation. Observed in the
`Telmisartan 20mg` group (`Telma 20 Tablet` at ₹92.70/30 and ₹48.81/15).
Not deduplicated or annotated today — the ₹/unit column already makes the
comparison correct even if the visual grouping doesn't call it out.

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
