import { describe, expect, it } from "vitest";
import { toCanonical } from "../units";

describe("toCanonical", () => {
  it("converts mass units to canonical mg", () => {
    expect(toCanonical(500, "Mg")).toEqual({ value: 500, unit: "mg" });
    expect(toCanonical(50, "Mcg")).toEqual({ value: 0.05, unit: "mg" });
    expect(toCanonical(1, "G")).toEqual({ value: 1000, unit: "mg" });
  });

  it("passes concentration units through unconverted", () => {
    expect(toCanonical(4, "%W/W")).toEqual({ value: 4, unit: "%w/w" });
    expect(toCanonical(25, "Mg/Ml")).toEqual({ value: 25, unit: "mg/ml" });
    expect(toCanonical(60, "ml")).toEqual({ value: 60, unit: "ml" });
  });
});
