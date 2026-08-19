import { createHash } from "node:crypto";

export interface FingerprintComponent {
  moleculeId: number;
  strengthValue: number;
  strengthUnit: string;
}

export interface FingerprintInput {
  components: FingerprintComponent[];
  dosageForm: string;
  releaseModifier: string | null;
}

export function fingerprint(input: FingerprintInput): string {
  const parts = input.components
    .map((c) => `${c.moleculeId}:${c.strengthValue.toFixed(3)}${c.strengthUnit}`)
    .sort(); // order-insensitive
  const payload = [parts.join("+"), input.dosageForm, input.releaseModifier ?? "none"].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

// Looser than fingerprint(): molecule identity only, no strength/dosage
// form/release modifier. Banned-FDC notifications specify molecule sets, not
// our dosage-form granularity, so this is what a notification can join against.
export function moleculeSetHash(moleculeIds: number[]): string {
  const sorted = [...new Set(moleculeIds)].sort((a, b) => a - b);
  return createHash("sha256").update(sorted.join("+")).digest("hex");
}
