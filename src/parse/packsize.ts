export interface ParsedPackSize {
  count: number;
  type: string; // tablet | capsule | ml | g | patch | suppository | unit
}

const GRAM_RE = /^(\d+(?:\.\d+)?)\s*(?:g|gm)\b/i;
const ML_RE = /^(\d+(?:\.\d+)?)\s*ml\b/i;
// "15 Tablet(s) in Strip" — word directly before "(s)" is the unit; a modifier word before it (e.g. "Rectal") is ignored
const WORD_UNIT_RE = /^(\d+(?:\.\d+)?)\s*(?:[A-Za-z]+\s+)?([A-Za-z]+)\(s\)/i;
// "10's" — count only, no stated type, disambiguated below via dosageFormHint
const APOSTROPHE_S_RE = /^(\d+)\s*'s\b/i;

export function parsePackSize(raw: string | null, dosageFormHint?: string | null): ParsedPackSize | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const gram = GRAM_RE.exec(trimmed);
  if (gram) return { count: Number(gram[1]), type: "g" };

  const ml = ML_RE.exec(trimmed);
  if (ml) return { count: Number(ml[1]), type: "ml" };

  const word = WORD_UNIT_RE.exec(trimmed);
  if (word) return { count: Number(word[1]), type: word[2].toLowerCase() };

  const apostrophe = APOSTROPHE_S_RE.exec(trimmed);
  if (apostrophe) {
    const type = dosageFormHint === "capsule" ? "capsule" : dosageFormHint === "tablet" ? "tablet" : "unit";
    return { count: Number(apostrophe[1]), type };
  }

  return null;
}
