import { describe, expect, it } from "vitest";
import { annualSaving, pctCheaper, perUnit } from "../savings";

describe("perUnit", () => {
  it("divides price by pack count and rounds to 2 decimals", () => {
    expect(perUnit(256.29, 15)).toBe(17.09);
    expect(perUnit(14.69, 10)).toBe(1.47);
  });
});

describe("pctCheaper", () => {
  it("computes percent cheaper relative to the priciest option", () => {
    expect(pctCheaper(1.51, 17.09)).toBe(91);
    expect(pctCheaper(0.62, 1.47)).toBe(58);
  });

  it("returns 0 rather than dividing by zero when the priciest option is 0", () => {
    expect(pctCheaper(0, 0)).toBe(0);
  });

  it("returns 0 when there is nothing to save", () => {
    expect(pctCheaper(5, 5)).toBe(0);
  });
});

describe("annualSaving", () => {
  it("multiplies the per-unit gap by 365 at one unit/day", () => {
    expect(annualSaving(1.51, 17.09)).toBe(Math.round((17.09 - 1.51) * 365));
  });

  it("scales with units per day", () => {
    expect(annualSaving(1.51, 17.09, 2)).toBe(Math.round((17.09 - 1.51) * 2 * 365));
  });
});
