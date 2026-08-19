import { describe, expect, it } from "vitest";
import { fingerprint, moleculeSetHash, type FingerprintComponent } from "../fingerprint";

// stand-ins for what resolve.ts would return; "Diclofenac" resolves to the same id as Diclofenac Sodium via the alias table
const TELMISARTAN = 1;
const AMLODIPINE = 2;
const METFORMIN_HCL = 3;
const PARACETAMOL = 4;
const DICLOFENAC_SODIUM = 5;

function comp(moleculeId: number, strengthValue: number, strengthUnit = "mg"): FingerprintComponent {
  return { moleculeId, strengthValue, strengthUnit };
}

describe("fingerprint", () => {
  it("matches PharmEasy's regex grammar against Jan Aushadhi's free text for the same drug", () => {
    // "Telmisartan(40.0 Mg)+Amlodipine(5.0 Mg)" vs
    // "Telmisartan 40mg and Amlodipine 5mg Tablets IP"
    const pe = fingerprint({
      components: [comp(TELMISARTAN, 40), comp(AMLODIPINE, 5)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    const ja = fingerprint({
      components: [comp(TELMISARTAN, 40), comp(AMLODIPINE, 5)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    expect(pe).toBe(ja);
  });

  it("matches Metformin Hydrochloride across both grammars", () => {
    // "Metformin Hydrochloride(500.0 Mg)" vs "Metformin Hydrochloride Tablets IP 500mg"
    const pe = fingerprint({
      components: [comp(METFORMIN_HCL, 500)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    const ja = fingerprint({
      components: [comp(METFORMIN_HCL, 500)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    expect(pe).toBe(ja);
  });

  it("does not match when strength differs, even for the same molecule", () => {
    // "Paracetamol / Acetaminophen(650.0 Mg)" vs "Paracetamol Tablets IP 500mg"
    const pe = fingerprint({
      components: [comp(PARACETAMOL, 650)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    const ja = fingerprint({
      components: [comp(PARACETAMOL, 500)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    expect(pe).not.toBe(ja);
  });

  it("does not match when strength AND release modifier differ", () => {
    // "Diclofenac(50.0 Mg)" vs "Diclofenac Sodium Prolonged Release Tablets IP 100mg"
    const pe = fingerprint({
      components: [comp(DICLOFENAC_SODIUM, 50)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    const ja = fingerprint({
      components: [comp(DICLOFENAC_SODIUM, 100)],
      dosageForm: "tablet",
      releaseModifier: "prolonged",
    });
    expect(pe).not.toBe(ja);
  });

  it("is order-insensitive for the same component set", () => {
    const forward = fingerprint({
      components: [comp(TELMISARTAN, 40), comp(AMLODIPINE, 5)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    const reversed = fingerprint({
      components: [comp(AMLODIPINE, 5), comp(TELMISARTAN, 40)],
      dosageForm: "tablet",
      releaseModifier: null,
    });
    expect(forward).toBe(reversed);
  });
});

describe("moleculeSetHash", () => {
  it("ignores strength — different doses of the same molecule set still match, unlike fingerprint()", () => {
    // Aceclofenac 100mg + Paracetamol 325mg (a real scraped composition) vs
    // Aceclofenac 50mg + Paracetamol 125mg (the banned CDSCO strength) — same
    // molecule set, deliberately looser than fingerprint() so it can still
    // surface as a banned-FDC candidate.
    const scraped = moleculeSetHash([12, 4]);
    const banned = moleculeSetHash([12, 4]);
    expect(scraped).toBe(banned);
  });

  it("is order-insensitive and de-duplicates repeated ids", () => {
    expect(moleculeSetHash([TELMISARTAN, AMLODIPINE])).toBe(moleculeSetHash([AMLODIPINE, TELMISARTAN]));
    expect(moleculeSetHash([TELMISARTAN, TELMISARTAN, AMLODIPINE])).toBe(moleculeSetHash([TELMISARTAN, AMLODIPINE]));
  });

  it("differs when the molecule set differs, even by one component", () => {
    expect(moleculeSetHash([TELMISARTAN, AMLODIPINE])).not.toBe(moleculeSetHash([TELMISARTAN, AMLODIPINE, PARACETAMOL]));
  });
});
