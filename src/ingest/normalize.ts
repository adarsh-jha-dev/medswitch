// Bright Data's extraction JSON keys drift between collector versions, so these try a list of plausible spellings.
function getPath(raw: unknown, path: string): unknown {
  if (typeof raw !== "object" || raw === null) return undefined;
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (typeof acc !== "object" || acc === null) return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, raw);
}

export function pickString(raw: unknown, keys: string[]): string | null {
  for (const key of keys) {
    const value = getPath(raw, key);
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

// Also handles Bright Data's {value, currency, symbol} money objects.
export function pickNumber(raw: unknown, keys: string[]): number | null {
  for (const key of keys) {
    const value = getPath(raw, key);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseFloat(value.replace(/[^\d.]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
    if (typeof value === "object" && value !== null && "value" in value) {
      const inner = (value as { value: unknown }).value;
      if (typeof inner === "number" && Number.isFinite(inner)) return inner;
    }
  }
  return null;
}

// Collapses "X X" back to "X" — PharmEasy extraction sometimes duplicates a value read from two DOM locations.
export function dedupeRepeatedHalf(value: string | null): string | null {
  if (!value) return value;
  const match = value.match(/^(.+)\s\1$/);
  return match ? match[1] : value;
}

export function pickBoolean(raw: unknown, keys: string[], truthyWords: string[], falsyWords: string[]): boolean | null {
  for (const key of keys) {
    const value = getPath(raw, key);
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const lower = value.toLowerCase();
      if (truthyWords.some((w) => lower.includes(w))) return true;
      if (falsyWords.some((w) => lower.includes(w))) return false;
    }
  }
  return null;
}
