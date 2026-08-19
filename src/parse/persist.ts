import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { brandProduct, composition, compositionMolecule, molecule } from "../db/schema";
import { fingerprint, moleculeSetHash, type FingerprintComponent } from "./fingerprint";
import type { DosageForm, ReleaseModifier } from "./types";

const moleculeNameCache = new Map<number, string>();

async function getMoleculeName(id: number): Promise<string> {
  const cached = moleculeNameCache.get(id);
  if (cached) return cached;
  const [row] = await db.select({ name: molecule.name }).from(molecule).where(eq(molecule.id, id));
  const name = row?.name ?? `molecule#${id}`;
  moleculeNameCache.set(id, name);
  return name;
}

export async function upsertComposition(params: {
  components: FingerprintComponent[];
  dosageForm: DosageForm;
  releaseModifier: ReleaseModifier | null;
}): Promise<number> {
  const hash = fingerprint(params);
  const setHash = moleculeSetHash(params.components.map((c) => c.moleculeId));

  const [existing] = await db
    .select({ id: composition.id, moleculeSetHash: composition.moleculeSetHash })
    .from(composition)
    .where(eq(composition.fingerprintHash, hash));
  if (existing) {
    if (existing.moleculeSetHash === null) {
      await db.update(composition).set({ moleculeSetHash: setHash }).where(eq(composition.id, existing.id));
    }
    return existing.id;
  }

  const names = await Promise.all(params.components.map((c) => getMoleculeName(c.moleculeId)));
  const normalizedText =
    params.components.map((c, i) => `${names[i]} ${c.strengthValue}${c.strengthUnit}`).join(" + ") +
    ` (${params.dosageForm}${params.releaseModifier ? `, ${params.releaseModifier}` : ""})`;

  const [inserted] = await db
    .insert(composition)
    .values({
      fingerprintHash: hash,
      normalizedText,
      dosageForm: params.dosageForm,
      releaseModifier: params.releaseModifier,
      moleculeSetHash: setHash,
    })
    .onConflictDoNothing({ target: composition.fingerprintHash })
    .returning({ id: composition.id });

  if (inserted) {
    for (const c of params.components) {
      await db
        .insert(compositionMolecule)
        .values({
          compositionId: inserted.id,
          moleculeId: c.moleculeId,
          strengthValue: c.strengthValue.toFixed(3),
          strengthUnit: c.strengthUnit,
        })
        .onConflictDoNothing({
          target: [compositionMolecule.compositionId, compositionMolecule.moleculeId],
        });
    }
    return inserted.id;
  }

  const [refetched] = await db.select({ id: composition.id }).from(composition).where(eq(composition.fingerprintHash, hash));
  return refetched.id;
}

function computeBrandKey(params: {
  name: string;
  manufacturer: string | null;
  compositionId: number;
  packSize: string | null;
}): string {
  const payload = [
    params.name.trim().toLowerCase(),
    (params.manufacturer ?? "").trim().toLowerCase(),
    params.compositionId,
    (params.packSize ?? "").trim().toLowerCase(),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export async function upsertBrandProduct(params: {
  canonicalName: string;
  manufacturer: string | null;
  compositionId: number;
  packSize: string | null;
  packUnitCount: number | null;
  packUnitType: string | null;
  isGeneric: boolean;
}): Promise<number> {
  const brandKey = computeBrandKey({
    name: params.canonicalName,
    manufacturer: params.manufacturer,
    compositionId: params.compositionId,
    packSize: params.packSize,
  });

  const [existing] = await db.select({ id: brandProduct.id }).from(brandProduct).where(eq(brandProduct.brandKey, brandKey));
  if (existing) return existing.id;

  const [inserted] = await db
    .insert(brandProduct)
    .values({ ...params, brandKey })
    .onConflictDoNothing({ target: brandProduct.brandKey })
    .returning({ id: brandProduct.id });

  if (inserted) return inserted.id;

  const [refetched] = await db.select({ id: brandProduct.id }).from(brandProduct).where(eq(brandProduct.brandKey, brandKey));
  return refetched.id;
}
