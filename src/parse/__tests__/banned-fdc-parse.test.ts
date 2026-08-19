import { describe, expect, it } from "vitest";
import { parseBannedFdcComponents } from "../banned-fdc-parse";

describe("parseBannedFdcComponents", () => {
  it("extracts name and strength, stripping the trailing dosage form", () => {
    expect(parseBannedFdcComponents("Aceclofenac 50mg + Paracetamol 125mg tablet")).toEqual([
      { name: "Aceclofenac", strengthMg: 50 },
      { name: "Paracetamol", strengthMg: 125 },
    ]);
  });

  it("handles components with no stated strength", () => {
    expect(parseBannedFdcComponents("Sucralfate + Aceclofenac")).toEqual([
      { name: "Sucralfate", strengthMg: null },
      { name: "Aceclofenac", strengthMg: null },
    ]);
  });

  it("drops parenthetical asides", () => {
    expect(parseBannedFdcComponents("Norfloxacin + Tinidazole (with Betacyclodextrin) Eye ointment")).toEqual([
      { name: "Norfloxacin", strengthMg: null },
      { name: "Tinidazole", strengthMg: null },
    ]);
  });

  it("cuts an 'eq. to' equivalence clause, keeping the stated salt", () => {
    expect(parseBannedFdcComponents("Erythromycin stearate eq. to Erythromycin + Lactic acid Bacillus")).toEqual([
      { name: "Erythromycin stearate", strengthMg: null },
      { name: "Lactic acid Bacillus", strengthMg: null },
    ]);
  });

  it("strips a leading 'Combikit of' prefix", () => {
    expect(parseBannedFdcComponents("Combikit of Clomiphene Citrate + Estradiol Valerate")).toEqual([
      { name: "Clomiphene Citrate", strengthMg: null },
      { name: "Estradiol Valerate", strengthMg: null },
    ]);
  });
});
