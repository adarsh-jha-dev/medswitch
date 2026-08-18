import { describe, expect, it } from "vitest";
import { parseStructured } from "../grammar";

describe("parseStructured (PharmEasy grammar)", () => {
  it("parses a single component", () => {
    expect(parseStructured("Diclofenac(50.0 Mg)")).toEqual([
      { rawName: "Diclofenac", strengthValue: 50, strengthUnit: "mg" },
    ]);
  });

  it("parses a two-drug combination joined by +", () => {
    expect(parseStructured("Telmisartan(40.0 Mg)+Amlodipine(5.0 Mg)")).toEqual([
      { rawName: "Telmisartan", strengthValue: 40, strengthUnit: "mg" },
      { rawName: "Amlodipine", strengthValue: 5, strengthUnit: "mg" },
    ]);
  });

  it("hands back a slash-joined synonym name verbatim", () => {
    expect(parseStructured("Paracetamol / Acetaminophen(650.0 Mg)")).toEqual([
      { rawName: "Paracetamol / Acetaminophen", strengthValue: 650, strengthUnit: "mg" },
    ]);
  });

  it("converts mcg and g to canonical mg", () => {
    expect(parseStructured("Levothyroxine(50.0 Mcg)")).toEqual([
      { rawName: "Levothyroxine", strengthValue: 0.05, strengthUnit: "mg" },
    ]);
    expect(parseStructured("SomeDrug(1.0 G)")).toEqual([
      { rawName: "SomeDrug", strengthValue: 1000, strengthUnit: "mg" },
    ]);
  });

  it("keeps concentration units (%w/w, mg/ml) uncoverted", () => {
    expect(parseStructured("Diclofenac Sodium(4.0 %W/W)")).toEqual([
      { rawName: "Diclofenac Sodium", strengthValue: 4, strengthUnit: "%w/w" },
    ]);
    expect(parseStructured("Diclofenac Sodium(25.0 Mg/Ml)")).toEqual([
      { rawName: "Diclofenac Sodium", strengthValue: 25, strengthUnit: "mg/ml" },
    ]);
  });

  it("parses a three-way combination", () => {
    const result = parseStructured(
      "Ibuprofen(100.0 Mg/5ml)+Paracetamol / Acetaminophen(162.5 Mg/5ml)",
    );
    expect(result).toHaveLength(2);
    expect(result?.[0].rawName).toBe("Ibuprofen");
    expect(result?.[1].rawName).toBe("Paracetamol / Acetaminophen");
  });

  it("bails to null on Jan Aushadhi's free-text grammar", () => {
    expect(parseStructured("Telmisartan 40mg and Amlodipine 5mg Tablets IP")).toBeNull();
    expect(
      parseStructured("Diclofenac Sodium Prolonged Release Tablets IP 100 mg"),
    ).toBeNull();
  });

  it("bails to null when the regex only explains a small fraction of the string", () => {
    // A parenthesized aside that isn't a dose shouldn't be treated as a real parse.
    expect(parseStructured("Some Long Free Text Description (see leaflet) Tablets IP")).toBeNull();
  });
});
