// moleculeName must match an entry already seeded in scripts/seed.ts.
export const ALIAS_SEED: Array<{ moleculeName: string; aliases: string[] }> = [
  { moleculeName: "Paracetamol", aliases: ["Acetaminophen", "Paracetamol / Acetaminophen"] },
  { moleculeName: "Metformin Hydrochloride", aliases: ["Metformin"] },
  { moleculeName: "Amlodipine", aliases: ["Amlodipine Besylate", "Amlodipine Besilate"] },
  // Diclofenac sodium and diclofenac potassium have different onset profiles,
  // so resolve.ts flags this pairing as a salt mismatch (raw omits the salt)
  // and caps match_confidence at 0.6 rather than auto-matching it.
  { moleculeName: "Diclofenac Sodium", aliases: ["Diclofenac"] },
];
