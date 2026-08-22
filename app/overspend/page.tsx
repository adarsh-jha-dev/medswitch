import Link from "next/link";
import { getOverspendSummary } from "../../src/queries/overspend";
import { formatRupees, formatRupeesWhole } from "../../src/lib/format";
import { Card, CardContent } from "../../src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../src/components/ui/table";

export const dynamic = "force-dynamic";

export default async function OverspendPage() {
  const summary = await getOverspendSummary();

  return (
    <main className="mx-auto my-10 w-full max-w-4xl rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">What brands cost, against the government price</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every scraped brand listing that shares a composition with a priced Jan Aushadhi generic, compared per unit —
        one query across everything we&rsquo;ve matched, not a single anecdote.
      </p>

      {summary.listingCount === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No overlapping compositions between Jan Aushadhi and a branded retailer yet — run the pipeline for both to
          populate this page.
        </p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="bg-brand-tint">
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Median markup</p>
                <p className="tnum mt-1 text-2xl font-semibold text-brand">{summary.medianMarkup}&times;</p>
                <p className="mt-1 text-xs text-muted-foreground">the Jan Aushadhi price</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Compositions compared</p>
                <p className="tnum mt-1 text-2xl font-semibold">{summary.groupCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">{summary.listingCount} brand listings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total annual overspend</p>
                <p className="tnum mt-1 text-2xl font-semibold">{formatRupeesWhole(summary.totalAnnualOverspend)}</p>
                <p className="mt-1 text-xs text-muted-foreground">if every listed brand were bought daily, one year</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-8 py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Composition</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Retailer</TableHead>
                    <TableHead>₹/unit</TableHead>
                    <TableHead>Jan Aushadhi ₹/unit</TableHead>
                    <TableHead>Markup</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rows.map((r, i) => (
                    <TableRow key={`${r.compositionId}-${r.brandName}-${r.retailer}-${i}`}>
                      <TableCell className="max-w-[16rem] align-top whitespace-normal text-sm">{r.normalizedText}</TableCell>
                      <TableCell className="align-top text-sm">{r.brandName}</TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">{r.retailer}</TableCell>
                      <TableCell className="tnum align-top text-sm">{formatRupees(r.perUnit)}</TableCell>
                      <TableCell className="tnum align-top text-sm text-muted-foreground">{formatRupees(r.janPerUnit)}</TableCell>
                      <TableCell className="tnum align-top text-sm font-semibold">{r.markup}&times;</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/search" className="underline hover:no-underline">
          Browse individual compositions
        </Link>
      </p>
    </main>
  );
}
