import { type DosageForm, type ReleaseModifier } from "./types";

// pack_size ("15 Tablet(s) in Strip") is a structured field, so a match there
// counts as explicit; only falling back to the free-text title counts as inferred.
const FORM_KEYWORDS: Array<[RegExp, DosageForm]> = [
  [/\btablet/i, "tablet"],
  [/\bcapsule/i, "capsule"],
  [/\bsuppository/i, "suppository"],
  [/\bsuspension/i, "suspension"],
  [/\binjection/i, "injection"],
  [/\bgel\b/i, "gel"],
  [/\bpatch/i, "patch"],
  [/\bcream/i, "cream"],
  [/\bdrops?\b/i, "drops"],
  [/\bspray/i, "spray"],
  [/\bsyrup/i, "syrup"],
];

function matchForm(text: string): DosageForm | null {
  for (const [re, form] of FORM_KEYWORDS) {
    if (re.test(text)) return form;
  }
  return null;
}

export function inferDosageForm(
  title: string | null,
  packSize: string | null,
): { form: DosageForm; explicit: boolean } {
  if (packSize) {
    const fromPack = matchForm(packSize);
    if (fromPack) return { form: fromPack, explicit: true };
  }
  if (title) {
    const fromTitle = matchForm(title);
    if (fromTitle) return { form: fromTitle, explicit: false };
  }
  return { form: "other", explicit: false };
}

const RELEASE_KEYWORDS: Array<[RegExp, ReleaseModifier]> = [
  [/\bsustained[\s-]?release\b|\bSR\b/i, "sustained"],
  [/\bprolonged[\s-]?release\b|\bPR\b/, "prolonged"],
  [/\bextended[\s-]?release\b|\bER\b|\bXR\b/, "extended"],
  [/\bgastro[\s-]?resistant\b/i, "gastro-resistant"],
  [/\benteric\b/i, "enteric"],
  [/\bdispersible\b|\bDT\b/, "dispersible"],
];

export function inferReleaseModifier(title: string | null): ReleaseModifier | null {
  if (!title) return null;
  for (const [re, modifier] of RELEASE_KEYWORDS) {
    if (re.test(title)) return modifier;
  }
  return null;
}
