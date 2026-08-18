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
