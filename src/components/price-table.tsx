import type { SubstitutionListing } from "../queries/substitution";
import { formatDateTime, formatRupees } from "../lib/format";

function Row({ listing, cheapest }: { listing: SubstitutionListing; cheapest: boolean }) {
  return (
    <tr className={cheapest ? "bg-accent-tint" : undefined}>
      <td className="py-3 pr-4 align-top">
        <a href={listing.productUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
          {listing.retailer}
        </a>
        <p className="mt-0.5 text-xs text-muted">captured {formatDateTime(listing.capturedAt)}</p>
      </td>
      <td className="py-3 pr-4 align-top">
        <p className="text-sm">{listing.brandName}</p>
        <p className="mt-0.5 text-xs text-muted">
          {listing.manufacturer ?? "Manufacturer not listed"}
          {listing.isGeneric ? " · generic" : ""}
        </p>
      </td>
      <td className="py-3 pr-4 align-top text-sm text-muted">{listing.packSize ?? `${listing.packUnitCount} units`}</td>
      <td className="tnum py-3 pr-4 align-top text-sm">
        {formatRupees(listing.salePrice)}
        {listing.mrp && listing.mrp > listing.salePrice ? (
          <span className="ml-1.5 text-xs text-muted line-through">{formatRupees(listing.mrp)}</span>
        ) : null}
      </td>
      <td className="tnum py-3 align-top text-sm font-semibold">
        {formatRupees(listing.perUnit)}
        {cheapest ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">cheapest</span> : null}
      </td>
    </tr>
  );
}

export function PriceTable({ ranked, pendingReview }: { ranked: SubstitutionListing[]; pendingReview: SubstitutionListing[] }) {
  if (ranked.length === 0 && pendingReview.length === 0) {
    return <p className="text-sm text-muted">No priced listings found for this composition yet.</p>;
  }

  return (
    <div className="mb-8">
      {ranked.length === 0 ? (
        <p className="text-sm text-muted">
          Only pending-review listings exist for this composition — nothing confirmed enough to compare yet. See below.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 pr-4 font-medium">Retailer</th>
                <th className="pb-2 pr-4 font-medium">Brand</th>
                <th className="pb-2 pr-4 font-medium">Pack</th>
                <th className="pb-2 pr-4 font-medium">Price</th>
                <th className="pb-2 font-medium">₹/unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.map((l, i) => (
                <Row key={l.listingId} listing={l} cheapest={i === 0} />
              ))}
            </tbody>
          </table>
          {ranked.length === 1 ? (
            <p className="mt-3 text-sm text-muted">Only found at one retailer so far — no price comparison available yet.</p>
          ) : null}
        </div>
      )}

      {pendingReview.length > 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-border px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Pending review — not counted in the comparison above
          </p>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            {pendingReview.map((l) => (
              <li key={l.listingId}>
                {l.retailer} — {l.brandName} ({formatRupees(l.salePrice)}/{l.packUnitCount})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
