import { describe, expect, it } from "vitest";
import { normalizeMoleculeName } from "../resolve";

describe("normalizeMoleculeName", () => {
  it("collapses punctuation spellings of the same molecule name to one form", () => {
    const variants = [
      "S(-)Amlodipine",
      "S- Amlodipine",
      "S (-) Amlodipine",
      "S(-) Amlodipine",
      "S-Amlodipine",
    ];
    const normalized = new Set(variants.map(normalizeMoleculeName));
    expect(normalized.size).toBe(1);
    expect([...normalized][0]).toBe("s amlodipine");
  });

  it("still collapses plain whitespace variation", () => {
    expect(normalizeMoleculeName("  Metformin   Hydrochloride ")).toBe("metformin hydrochloride");
  });
});
