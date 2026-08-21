// moleculeName must match an entry already seeded in scripts/seed.ts.
export const ALIAS_SEED: Array<{ moleculeName: string; aliases: string[] }> = [
  { moleculeName: "Paracetamol", aliases: ["Acetaminophen", "Paracetamol / Acetaminophen"] },
  { moleculeName: "Metformin Hydrochloride", aliases: ["Metformin"] },
  { moleculeName: "Amlodipine", aliases: ["Amlodipine Besylate", "Amlodipine Besilate"] },
  // Diclofenac sodium/potassium have different onset profiles — resolve.ts caps this pairing at match_confidence 0.6.
  { moleculeName: "Diclofenac Sodium", aliases: ["Diclofenac"] },
];
