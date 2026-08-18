import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { listing, retailer } from "../src/db/schema";
import { inferDosageForm, inferReleaseModifier } from "../src/parse/dosageform";
import { parseStructured } from "../src/parse/grammar";
import { parseWithLlm } from "../src/parse/llm";
import { parsePackSize } from "../src/parse/packsize";
import { upsertBrandProduct, upsertComposition } from "../src/parse/persist";
import { resolveMolecule } from "../src/parse/resolve";
import type { DosageForm, ParsedComponent, ParseMethod, ReleaseModifier } from "../src/parse/types";
import { toCanonical } from "../src/parse/units";

async function main() {
  const rows = await db
    .select({
      id: listing.id,
      retailerSlug: retailer.slug,
      rawCompositionText: listing.rawCompositionText,
      rawTitle: listing.rawTitle,
      rawManufacturer: listing.rawManufacturer,
      rawPackSize: listing.rawPackSize,
    })
    .from(listing)
    .innerJoin(retailer, eq(retailer.id, listing.retailerId));

  const withComposition = rows.filter((r) => r.rawCompositionText !== null);
  const distinctRaw = [...new Set(withComposition.map((r) => r.rawCompositionText!))];

  const regexComponents = new Map<string, ParsedComponent[]>();
  const needsLlm: string[] = [];
  for (const raw of distinctRaw) {
    const components = parseStructured(raw);
    if (components) regexComponents.set(raw, components);
    else needsLlm.push(raw);
  }

  console.log(`Regex parsed ${regexComponents.size}/${distinctRaw.length} distinct compositions. LLM parsing ${needsLlm.length}...`);
  const llmResults = await parseWithLlm(needsLlm);

  let autoCount = 0;
  let reviewCount = 0;
  let unmatchedCount = 0;
  const unresolvedMolecules = new Map<string, number>();
  const bothRetailerCompositions = new Set<number>();
  const compositionRetailers = new Map<number, Set<string>>();

  for (const row of withComposition) {
    const raw = row.rawCompositionText!;
    const isRegex = regexComponents.has(raw);
    const method: ParseMethod = isRegex ? "regex" : "llm";

    let components: ParsedComponent[];
    let dosageForm: DosageForm;
    let dosageFormInferred: boolean;
    let releaseModifier: ReleaseModifier | null;

    if (isRegex) {
      components = regexComponents.get(raw)!;
      const inferred = inferDosageForm(row.rawTitle, row.rawPackSize);
      dosageForm = inferred.form;
      dosageFormInferred = !inferred.explicit;
      releaseModifier = inferReleaseModifier(row.rawTitle);
    } else {
      const parsed = llmResults.get(raw);
      if (!parsed) {
        await db.update(listing).set({ matchStatus: "unmatched", matchConfidence: null, brandProductId: null }).where(eq(listing.id, row.id));
        unmatchedCount++;
        continue;
      }
      components = parsed.components;
      dosageForm = parsed.dosageForm;
      dosageFormInferred = parsed.dosageFormInferred;
      releaseModifier = parsed.releaseModifier;
    }

    const resolvedComponents = [];
    let anySaltMismatch = false;
    for (const comp of components) {
      const canonical = toCanonical(comp.strengthValue, comp.strengthUnit);
      const resolved = await resolveMolecule(comp.rawName);
      if (resolved.saltMismatch) anySaltMismatch = true;
      if (resolved.method === "created") {
        unresolvedMolecules.set(comp.rawName, (unresolvedMolecules.get(comp.rawName) ?? 0) + 1);
      }
      resolvedComponents.push({ moleculeId: resolved.moleculeId, strengthValue: canonical.value, strengthUnit: canonical.unit });
    }

    const compositionId = await upsertComposition({ components: resolvedComponents, dosageForm, releaseModifier });

    if (!compositionRetailers.has(compositionId)) compositionRetailers.set(compositionId, new Set());
    compositionRetailers.get(compositionId)!.add(row.retailerSlug);
    if (compositionRetailers.get(compositionId)!.size > 1) bothRetailerCompositions.add(compositionId);

    const packSize = parsePackSize(row.rawPackSize, dosageForm);
    const brandProductId = await upsertBrandProduct({
      canonicalName: row.rawTitle ?? "Unknown",
      manufacturer: row.rawManufacturer,
      compositionId,
      packSize: row.rawPackSize,
      packUnitCount: packSize?.count ?? null,
      packUnitType: packSize?.type ?? null,
      isGeneric: row.retailerSlug === "janaushadhi",
    });

    // 1.00 regex / 0.85 LLM, capped to 0.60 on salt mismatch, 0.40 if dosage form was inferred; < 0.75 -> review
    let confidence = method === "regex" ? 1.0 : 0.85;
    if (anySaltMismatch) confidence = Math.min(confidence, 0.6);
    if (dosageFormInferred) confidence = Math.min(confidence, 0.4);

    const matchStatus = confidence >= 0.75 ? "auto" : "review";
    if (matchStatus === "auto") autoCount++;
    else reviewCount++;

    await db
      .update(listing)
      .set({ brandProductId, matchStatus, matchConfidence: confidence.toFixed(3) })
      .where(eq(listing.id, row.id));
  }

  console.log(`\nDone. ${withComposition.length} listings processed, ${rows.length - withComposition.length} skipped (no raw_composition_text).`);
  console.log(`match_status: auto=${autoCount} review=${reviewCount} unmatched=${unmatchedCount}`);
  console.log(`Composition groups spanning both retailers: ${bothRetailerCompositions.size}`);
  if (unresolvedMolecules.size > 0) {
    console.log(`\nNewly created (unrecognized) molecules, by frequency:`);
    [...unresolvedMolecules.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => console.log(`  ${count}x  ${name}`));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
