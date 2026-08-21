// Best-effort component extraction from CDSCO's free-text FDC descriptions —
// only needs to be reliable for items that share molecules with our seed list.
const TRAILING_DOSAGE_FORM = new RegExp(
  "\\s*(oral liquid|eye ointment|eye drops?|topical spray|injection|tablets?|capsules?|ointment|solution|suspension|syrup|cream|gel|lotion|soap|spray)\\s*$",
  "i",
);

const STRENGTH_MG = /(\d+(?:\.\d+)?)\s*mg\b/i;
const LEADING_STRENGTH_CUTOFF = /\d/;

export interface BannedFdcComponent {
  name: string;
  strengthMg: number | null;
}

export function parseBannedFdcComponents(rawText: string): BannedFdcComponent[] {
  const withoutTrailingForm = rawText.replace(TRAILING_DOSAGE_FORM, "");

  return withoutTrailingForm
    .split("+")
    .map((part): BannedFdcComponent | null => {
      let name = part
        .replace(/\([^)]*\)/g, " ") // parenthetical asides
        .replace(/\beq\.?\s*to\b.*$/i, "") // "eq. to X" — keep the stated salt, drop the equivalence tail
        .replace(/^combikit of\s*/i, "")
        .trim();

      const strengthMatch = name.match(STRENGTH_MG);
      const strengthMg = strengthMatch ? Number(strengthMatch[1]) : null;

      const cutIndex = name.search(LEADING_STRENGTH_CUTOFF);
      if (cutIndex > 0) name = name.slice(0, cutIndex);
      name = name.replace(/\s+/g, " ").trim();

      if (!name) return null;
      return { name, strengthMg };
    })
    .filter((c): c is BannedFdcComponent => c !== null);
}
