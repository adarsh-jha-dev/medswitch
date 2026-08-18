import { describe, expect, it } from "vitest";
import { parsePackSize } from "../packsize";

describe("parsePackSize", () => {
  it("parses PharmEasy's structured pack strings", () => {
    expect(parsePackSize("15 Tablet(s) in Strip")).toEqual({ count: 15, type: "tablet" });
    expect(parsePackSize("10 Capsule(s) in Strip")).toEqual({ count: 10, type: "capsule" });
    expect(parsePackSize("5 Rectal Suppository(s) in Strip")).toEqual({ count: 5, type: "suppository" });
    expect(parsePackSize("60ml Suspension in Bottle")).toEqual({ count: 60, type: "ml" });
    expect(parsePackSize("3ml Injection in Ampoule")).toEqual({ count: 3, type: "ml" });
    expect(parsePackSize("50g Gel in Tube")).toEqual({ count: 50, type: "g" });
    expect(parsePackSize("3 Patch(s) in Packet")).toEqual({ count: 3, type: "patch" });
  });

  it("parses Jan Aushadhi's pack strings", () => {
    expect(parsePackSize("15 g")).toEqual({ count: 15, type: "g" });
    expect(parsePackSize("30 GM")).toEqual({ count: 30, type: "g" });
    expect(parsePackSize("35 gm")).toEqual({ count: 35, type: "g" });
    expect(parsePackSize("60 ML")).toEqual({ count: 60, type: "ml" });
    expect(parsePackSize("100 ml")).toEqual({ count: 100, type: "ml" });
    expect(parsePackSize("30gm Lami-Tube in Monopack")).toEqual({ count: 30, type: "g" });
  });

  it("falls back to the dosage-form hint for the ambiguous N's pattern", () => {
    expect(parsePackSize("10's", "tablet")).toEqual({ count: 10, type: "tablet" });
    expect(parsePackSize("10's", "capsule")).toEqual({ count: 10, type: "capsule" });
    expect(parsePackSize("15's", null)).toEqual({ count: 15, type: "unit" });
    expect(parsePackSize("10's in Mono-carton", "tablet")).toEqual({ count: 10, type: "tablet" });
  });

  it("returns null when the count can't enter a price comparison", () => {
    expect(parsePackSize(null)).toBeNull();
    expect(parsePackSize("")).toBeNull();
    expect(parsePackSize("Combipack")).toBeNull();
  });
});
