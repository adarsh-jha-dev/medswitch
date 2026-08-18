// concentration/volume units (ml, iu, %, mg/ml, %w/w) have no mg equivalent and pass through unchanged
const MASS_TO_MG: Record<string, number> = {
  mg: 1,
  mcg: 1 / 1000,
  g: 1000,
};

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, "");
}

export function toCanonical(value: number, unit: string): { value: number; unit: string } {
  const normalized = normalizeUnit(unit);
  const factor = MASS_TO_MG[normalized];
  if (factor === undefined) return { value, unit: normalized };
  return { value: value * factor, unit: "mg" };
}
