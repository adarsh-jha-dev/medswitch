export interface ParsedComponent {
  rawName: string;
  strengthValue: number;
  strengthUnit: string; // canonical "mg" when convertible, otherwise as printed (e.g. "mg/ml", "%w/w", "iu", "ml")
}

export const dosageForms = [
  "tablet",
  "capsule",
  "syrup",
  "suspension",
  "injection",
  "cream",
  "gel",
  "drops",
  "spray",
  "patch",
  "suppository",
  "other",
] as const;
export type DosageForm = (typeof dosageForms)[number];

export const releaseModifiers = [
  "sustained",
  "prolonged",
  "extended",
  "enteric",
  "dispersible",
  "gastro-resistant",
] as const;
export type ReleaseModifier = (typeof releaseModifiers)[number];

export interface ParsedComposition {
  components: ParsedComponent[];
  dosageForm: DosageForm;
  dosageFormInferred: boolean; // true when derived from title/pack rather than stated in the composition text
  releaseModifier: ReleaseModifier | null;
}

export type ParseMethod = "regex" | "llm";
