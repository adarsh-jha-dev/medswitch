import { describe, expect, it } from "vitest";
import { rankSearchCandidates } from "../substitution";

describe("rankSearchCandidates", () => {
  it("ranks a single-molecule brand above a combination that shares its prefix", () => {
    // Reproduces the observed bug: resolveSubstitutionGroup("Glycomet") used to
    // take searchProducts()[0] in whatever order Postgres returned rows, which
    // could land on "Glycomet Gp 2/850Mg" (a Glimepiride + Metformin combination)
    // instead of plain "Glycomet Tablet" (Metformin alone).
    const candidates = [
      {
        fingerprintHash: "combo-gp2-850",
        normalizedText: "Glimepiride 2mg + Metformin Hydrochloride 850mg (tablet)",
        matchedOn: "Glycomet Gp 2/850Mg Strip Of 10 Tablets",
        moleculeCount: 2,
        retailerCount: 1,
      },
      {
        fingerprintHash: "combo-gp2",
        normalizedText: "Metformin Hydrochloride 500mg + Glimepiride 2mg (tablet)",
        matchedOn: "Glycomet GP 2 Tablet",
        moleculeCount: 2,
        retailerCount: 1,
      },
      {
        fingerprintHash: "plain-500",
        normalizedText: "Metformin Hydrochloride 500mg (tablet)",
        matchedOn: "Glycomet Tablet",
        moleculeCount: 1,
        retailerCount: 1,
      },
      {
        fingerprintHash: "plain-500-sr",
        normalizedText: "Metformin Hydrochloride 500mg (tablet, sustained)",
        matchedOn: "Glycomet 500 SR Tablet",
        moleculeCount: 1,
        retailerCount: 1,
      },
    ];

    const ranked = rankSearchCandidates("Glycomet", candidates);

    expect(ranked[0].fingerprintHash).toBe("plain-500");
    expect(ranked[0].moleculeCount).toBe(1);
  });

  it("puts an exact normalized match first regardless of molecule count", () => {
    const candidates = [
      { fingerprintHash: "combo", normalizedText: "x", matchedOn: "Telma AM", moleculeCount: 2, retailerCount: 1 },
      { fingerprintHash: "exact", normalizedText: "y", matchedOn: "Telma", moleculeCount: 1, retailerCount: 1 },
    ];

    const ranked = rankSearchCandidates("telma", candidates);

    expect(ranked[0].fingerprintHash).toBe("exact");
  });

  it("prefers a shorter name within the same tier when molecule counts tie", () => {
    const candidates = [
      { fingerprintHash: "long", normalizedText: "x", matchedOn: "Glycomet-1 GM Tablet", moleculeCount: 1, retailerCount: 1 },
      { fingerprintHash: "short", normalizedText: "y", matchedOn: "Glycomet Tablet", moleculeCount: 1, retailerCount: 1 },
    ];

    const ranked = rankSearchCandidates("Glycomet", candidates);

    expect(ranked[0].fingerprintHash).toBe("short");
  });

  it("prefers the strength named in the query when every other key ties", () => {
    const candidates = [
      {
        fingerprintHash: "z-750",
        normalizedText: "Metformin Hydrochloride 750mg (tablet)",
        matchedOn: "Metformin Hydrochloride",
        moleculeCount: 1,
        retailerCount: 1,
      },
      {
        fingerprintHash: "a-500",
        normalizedText: "Metformin Hydrochloride 500mg (tablet)",
        matchedOn: "Metformin Hydrochloride",
        moleculeCount: 1,
        retailerCount: 1,
      },
    ];

    const ranked = rankSearchCandidates("Metformin 500mg", candidates);

    expect(ranked[0].fingerprintHash).toBe("a-500");
  });

  it("prefers whichever strength actually has cross-retailer price data when the query names no strength", () => {
    // Reproduces a second observed failure: the agent's find_substitutes tool is
    // told to pass a bare molecule name (e.g. "Metformin"), never a strength, so
    // every strength ties on matchedOn/moleculeCount. Without this tiebreak the
    // choice degenerates to an arbitrary hash sort, which could land on a
    // strength with zero comparable listings and produce an unhelpful answer.
    const candidates = [
      {
        fingerprintHash: "z-750-no-data",
        normalizedText: "Metformin Hydrochloride 750mg (tablet)",
        matchedOn: "Metformin Hydrochloride",
        moleculeCount: 1,
        retailerCount: 0,
      },
      {
        fingerprintHash: "a-500-two-retailers",
        normalizedText: "Metformin Hydrochloride 500mg (tablet)",
        matchedOn: "Metformin Hydrochloride",
        moleculeCount: 1,
        retailerCount: 2,
      },
    ];

    const ranked = rankSearchCandidates("Metformin", candidates);

    expect(ranked[0].fingerprintHash).toBe("a-500-two-retailers");
  });
});
