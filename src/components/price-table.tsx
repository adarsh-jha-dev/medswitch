import type { SubstitutionListing } from "../queries/substitution";
import { formatDateTime, formatRupees } from "../lib/format";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

function Row({ listing, cheapest }: { listing: SubstitutionListing; cheapest: boolean }) {
  return (
    <TableRow className={cheapest ? "bg-brand-tint hover:bg-brand-tint" : undefined}>
      <TableCell className="align-top whitespace-normal">
        <a href={listing.productUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
          {listing.retailer}
        </a>
        <p className="mt-0.5 text-xs text-muted-foreground">captured {formatDateTime(listing.capturedAt)}</p>
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <p className="text-sm">{listing.brandName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {listing.manufacturer ?? "Manufacturer not listed"}
          {listing.isGeneric ? " · generic" : ""}
        </p>
      </TableCell>
      <TableCell className="align-top text-sm text-muted-foreground">{listing.packSize ?? `${listing.packUnitCount} units`}</TableCell>
      <TableCell className="tnum align-top text-sm">
        {formatRupees(listing.salePrice)}
        {listing.mrp && listing.mrp > listing.salePrice ? (
          <span className="ml-1.5 text-xs text-muted-foreground line-through">{formatRupees(listing.mrp)}</span>
        ) : null}
      </TableCell>
      <TableCell className="tnum align-top text-sm font-semibold">
        {formatRupees(listing.perUnit)}
        {cheapest ? (
          <Badge className="ml-2 bg-brand text-brand-foreground" variant="default">
            cheapest
          </Badge>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function PriceTable({ ranked, pendingReview }: { ranked: SubstitutionListing[]; pendingReview: SubstitutionListing[] }) {
  if (ranked.length === 0 && pendingReview.length === 0) {
    return <p className="text-sm text-muted-foreground">No priced listings found for this composition yet.</p>;
  }

  return (
    <div className="mb-8">
      {ranked.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Only pending-review listings exist for this composition — nothing confirmed enough to compare yet. See below.
        </p>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Retailer</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>₹/unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((l, i) => (
                  <Row key={l.listingId} listing={l} cheapest={i === 0} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
          {ranked.length === 1 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Only found at one retailer so far — no price comparison available yet.</p>
          ) : null}
        </Card>
      )}

      {pendingReview.length > 0 ? (
        <Card className="mt-6 border-dashed bg-transparent shadow-none">
          <CardContent>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pending review — not counted in the comparison above
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {pendingReview.map((l) => (
                <li key={l.listingId}>
                  {l.retailer} — {l.brandName} ({formatRupees(l.salePrice)}/{l.packUnitCount})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
