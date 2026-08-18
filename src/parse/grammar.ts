import type { ParsedComponent } from "./types";
import { toCanonical } from "./units";

// "Name(value Unit)" joined by "+", e.g. "Telmisartan(40.0 Mg)+Amlodipine(5.0 Mg)".
// Unit alternation is longest-first so "mg/5ml" doesn't get cut short by "mg".
const COMPONENT =
  /([A-Za-z0-9\s/\-]+?)\s*\(\s*([\d.]+)\s*(mg\/5?ml|%w\/w|mcg|mg|g|ml|iu|%)\s*\)/gi;

// below this, the string has a shape we don't recognize — bail to the LLM instead of a partial parse
const MIN_COVERAGE = 0.8;

export function parseStructured(raw: string): ParsedComponent[] | null {
  const parts = [...raw.matchAll(COMPONENT)];
  if (parts.length === 0) return null;

  const consumed = parts.reduce((n, m) => n + m[0].length, 0);
  if (consumed / raw.length < MIN_COVERAGE) return null;

  return parts.map((m) => {
    const [, name, value, unit] = m;
    const canonical = toCanonical(Number(value), unit);
    return {
      rawName: name.trim(),
      strengthValue: canonical.value,
      strengthUnit: canonical.unit,
    };
  });
}
