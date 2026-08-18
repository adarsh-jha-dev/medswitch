import { db } from "../db";
import { molecule, moleculeAlias } from "../db/schema";

const SALT_SUFFIXES = [
  "hydrochloride",
  "hcl",
  "besylate",
  "besilate",
  "phosphate",
  "succinate",
  "maleate",
  "mesylate",
  "sulphate",
  "sulfate",
  "acetate",
  "fumarate",
  "citrate",
  "tartrate",
  "trihydrate",
  "dihydrate",
  "diethylamine",
  "sodium",
  "potassium",
];

// Punctuation replaced with a space, not stripped: "S-Amlodipine" and
// "S(-) Amlodipine" both need to collapse to "s amlodipine", not merge into
// "samlodipine" for the no-space variant only.
export function normalizeMoleculeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSalt(normalized: string): boolean {
  return SALT_SUFFIXES.some((s) => new RegExp(`\\b${s}\\b`).test(normalized));
}

function stripSalt(normalized: string): string | null {
  for (const suffix of SALT_SUFFIXES) {
    const re = new RegExp(`\\s+${suffix}\\b`, "i");
    if (re.test(normalized)) return normalized.replace(re, "").trim();
  }
  return null;
}

export type ResolveMethod = "exact" | "alias" | "salt-strip" | "created";

export interface ResolvedMolecule {
  moleculeId: number;
  method: ResolveMethod;
  // one side states a salt/ester form and the other doesn't (the Diclofenac case)
  saltMismatch: boolean;
}

interface Caches {
  byNormalizedName: Map<string, number>;
  byId: Map<number, string>;
  byAlias: Map<string, number>;
}

let caches: Caches | null = null;

async function loadCaches(): Promise<Caches> {
  if (caches) return caches;
  const molecules = await db.select({ id: molecule.id, normalizedName: molecule.normalizedName }).from(molecule);
  const aliases = await db
    .select({ moleculeId: moleculeAlias.moleculeId, normalizedAlias: moleculeAlias.normalizedAlias })
    .from(moleculeAlias);

  caches = {
    byNormalizedName: new Map(molecules.map((m) => [m.normalizedName, m.id])),
    byId: new Map(molecules.map((m) => [m.id, m.normalizedName])),
    byAlias: new Map(aliases.map((a) => [a.normalizedAlias, a.moleculeId])),
  };
  return caches;
}

export function invalidateMoleculeCaches(): void {
  caches = null;
}

function resolveDirect(normalized: string, c: Caches): { moleculeId: number; method: ResolveMethod } | null {
  const exact = c.byNormalizedName.get(normalized);
  if (exact !== undefined) return { moleculeId: exact, method: "exact" };

  const aliased = c.byAlias.get(normalized);
  if (aliased !== undefined) return { moleculeId: aliased, method: "alias" };

  // Stripped form only matches exact molecule names, never the alias table:
  // stripping "Potassium" off "Diclofenac Potassium" must not fall through to
  // the "Diclofenac" -> Diclofenac Sodium alias and bridge two different salts.
  const stripped = stripSalt(normalized);
  if (stripped) {
    const strippedExact = c.byNormalizedName.get(stripped);
    if (strippedExact !== undefined) return { moleculeId: strippedExact, method: "salt-strip" };
  }

  return null;
}

async function createMolecule(rawName: string, normalized: string): Promise<number> {
  const [row] = await db
    .insert(molecule)
    .values({ name: rawName.trim(), normalizedName: normalized })
    .onConflictDoUpdate({ target: molecule.normalizedName, set: { normalizedName: normalized } })
    .returning({ id: molecule.id });
  invalidateMoleculeCaches();
  return row.id;
}

export async function resolveMolecule(rawName: string): Promise<ResolvedMolecule> {
  const c = await loadCaches();
  const normalized = normalizeMoleculeName(rawName);

  let direct = resolveDirect(normalized, c);

  // Check the raw string, not `normalized` — normalization strips "/" along
  // with other punctuation, so "Paracetamol / Acetaminophen" never survives
  // to be split here otherwise.
  if (!direct && rawName.includes("/")) {
    const parts = rawName.split("/").map((p) => normalizeMoleculeName(p)).filter(Boolean);
    const found = new Set<number>();
    let method: ResolveMethod = "alias";
    for (const part of parts) {
      const hit = resolveDirect(part, c);
      if (hit) {
        found.add(hit.moleculeId);
        method = hit.method;
      }
    }
    if (found.size === 1) {
      direct = { moleculeId: [...found][0], method };
    }
  }

  if (direct) {
    const moleculeNormalized = c.byId.get(direct.moleculeId) ?? "";
    const saltMismatch = hasSalt(normalized) !== hasSalt(moleculeNormalized);
    return { ...direct, saltMismatch };
  }

  const moleculeId = await createMolecule(rawName, normalized);
  return { moleculeId, method: "created", saltMismatch: false };
}
