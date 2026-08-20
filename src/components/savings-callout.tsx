import type { Savings } from "../queries/substitution";
import { formatDate, formatRupeesWhole } from "../lib/format";

export function SavingsCallout({ savings }: { savings: Savings }) {
  const cheapDate = formatDate(savings.cheapest.capturedAt);
  const pricyDate = formatDate(savings.priciest.capturedAt);
  const sameDate = cheapDate === pricyDate;

  return (
    <div className="mb-8 rounded-md border border-border bg-surface px-6 py-5">
      <p className="tnum text-4xl font-semibold text-accent">
        {formatRupeesWhole(savings.annualSaving)}
        <span className="ml-2 text-lg font-medium text-foreground">/year cheaper</span>
      </p>
      <p className="mt-2 text-sm text-muted">
        {savings.pctCheaper}% cheaper at {savings.cheapest.retailer} than the priciest listed alternative ({savings.priciest.retailer}),
        assuming one unit per day, at prices captured{" "}
        {sameDate ? `on ${cheapDate}` : `${cheapDate} (${savings.cheapest.retailer}) and ${pricyDate} (${savings.priciest.retailer})`}.
      </p>
    </div>
  );
}
