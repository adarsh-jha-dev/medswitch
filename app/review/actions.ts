"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../../src/db";
import { bannedFdcMolecule, compositionMolecule, listing, molecule, moleculeAlias, moleculeMergeSuggestion } from "../../src/db/schema";
import { invalidateMoleculeCaches } from "../../src/parse/resolve";

export async function approveMatch(listingId: number) {
  await db.update(listing).set({ matchStatus: "verified" }).where(eq(listing.id, listingId));
  revalidatePath("/review");
  revalidatePath("/");
}

export async function rejectMatch(listingId: number) {
  await db.update(listing).set({ matchStatus: "rejected" }).where(eq(listing.id, listingId));
  revalidatePath("/review");
  revalidatePath("/");
}

export async function rejectMerge(suggestionId: number) {
  await db
    .update(moleculeMergeSuggestion)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(eq(moleculeMergeSuggestion.id, suggestionId));
  revalidatePath("/review");
}

// Repoints composition_molecule/banned_fdc_molecule from B to A (both
// onDelete "restrict", so B can't be deleted while they still reference it),
// aliases B's name to A, then deletes B. Deleting B cascades away this
// suggestion row (molecule_merge_suggestion is onDelete "cascade") and any
// other pending suggestion naming B — so there's no row left to mark
// status="approved" on. That's the schema's cascade, not a bug here.
export async function approveMerge(suggestionId: number) {
  await db.transaction(async (tx) => {
    const [suggestion] = await tx
      .select()
      .from(moleculeMergeSuggestion)
      .where(eq(moleculeMergeSuggestion.id, suggestionId));
    if (!suggestion || suggestion.status !== "pending") return;

    const { moleculeAId: a, moleculeBId: b } = suggestion;

    const bComps = await tx.select().from(compositionMolecule).where(eq(compositionMolecule.moleculeId, b));
    for (const row of bComps) {
      const [existing] = await tx
        .select({ id: compositionMolecule.id })
        .from(compositionMolecule)
        .where(and(eq(compositionMolecule.compositionId, row.compositionId), eq(compositionMolecule.moleculeId, a)));
      if (existing) {
        await tx.delete(compositionMolecule).where(eq(compositionMolecule.id, row.id));
      } else {
        await tx.update(compositionMolecule).set({ moleculeId: a }).where(eq(compositionMolecule.id, row.id));
      }
    }

    const bBanned = await tx.select().from(bannedFdcMolecule).where(eq(bannedFdcMolecule.moleculeId, b));
    for (const row of bBanned) {
      const [existing] = await tx
        .select({ id: bannedFdcMolecule.id })
        .from(bannedFdcMolecule)
        .where(and(eq(bannedFdcMolecule.bannedFdcId, row.bannedFdcId), eq(bannedFdcMolecule.moleculeId, a)));
      if (existing) {
        await tx.delete(bannedFdcMolecule).where(eq(bannedFdcMolecule.id, row.id));
      } else {
        await tx.update(bannedFdcMolecule).set({ moleculeId: a }).where(eq(bannedFdcMolecule.id, row.id));
      }
    }

    await tx.update(moleculeAlias).set({ moleculeId: a }).where(eq(moleculeAlias.moleculeId, b));

    const [bMolecule] = await tx.select().from(molecule).where(eq(molecule.id, b));
    if (bMolecule) {
      await tx
        .insert(moleculeAlias)
        .values({ moleculeId: a, alias: bMolecule.name, normalizedAlias: bMolecule.normalizedName })
        .onConflictDoNothing({ target: moleculeAlias.normalizedAlias });
    }

    await tx.delete(molecule).where(eq(molecule.id, b));
  });

  invalidateMoleculeCaches();
  revalidatePath("/review");
}
