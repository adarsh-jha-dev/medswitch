// Callers are responsible for Number()-ing whatever the postgres driver
// handed back as a string before calling these.

export function perUnit(price: number, packUnitCount: number): number {
  return Math.round((price / packUnitCount) * 100) / 100;
}

// Relative to the priciest option, not the average.
export function pctCheaper(cheapestPerUnit: number, priciestPerUnit: number): number {
  if (priciestPerUnit <= 0) return 0;
  return Math.round(((priciestPerUnit - cheapestPerUnit) / priciestPerUnit) * 100);
}

export function annualSaving(cheapestPerUnit: number, priciestPerUnit: number, unitsPerDay = 1): number {
  return Math.round((priciestPerUnit - cheapestPerUnit) * unitsPerDay * 365);
}
