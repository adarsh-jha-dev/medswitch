import { collectorRuns, extractionIssuesByFieldAndRetailer, healEvents, retailerCoverage } from "../../src/queries/ops";
import { formatDateTime } from "../../src/lib/format";
import { Badge } from "../../src/components/ui/badge";
import { Card, CardContent } from "../../src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../src/components/ui/table";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [heals, runs, issues, coverage] = await Promise.all([
    healEvents(),
    collectorRuns(),
    extractionIssuesByFieldAndRetailer(),
    retailerCoverage(),
  ]);

  return (
    <main className="mx-auto my-10 w-full max-w-4xl rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Pipeline health</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every heal, run, and extraction gap is logged rather than silently patched — this page is that log, not a
        polished summary of it.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Heal log ({heals.length})</h2>
        <div className="flex flex-col gap-3">
          {heals.map((h) => (
            <Card key={h.id}>
              <CardContent>
                <p className="text-sm font-medium">
                  {h.collectorId}
                  {h.fieldName ? ` · ${h.fieldName}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{h.symptom}</p>
                {h.rowsBefore !== null && h.rowsAfter !== null ? (
                  <Badge variant="secondary" className="tnum mt-2">
                    {h.rowsBefore} → {h.rowsAfter} rows
                  </Badge>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">detected {formatDateTime(h.detectedAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Run history ({runs.length})</h2>
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Retailer</TableHead>
                  <TableHead>Collector</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.retailer}</TableCell>
                    <TableCell className="text-muted-foreground">{r.collectorId}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="tnum">{r.rowsExpected}</TableCell>
                    <TableCell className="tnum">{r.rowsReturned}</TableCell>
                    <TableCell className="tnum">{r.durationSeconds !== null ? `${r.durationSeconds}s` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Extraction issues ({issues.reduce((n, i) => n + i.count, 0)})</h2>
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Retailer</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((i) => (
                  <TableRow key={`${i.retailer}-${i.fieldName}`}>
                    <TableCell>{i.retailer}</TableCell>
                    <TableCell className="text-muted-foreground">{i.fieldName}</TableCell>
                    <TableCell className="tnum">{i.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Apollo Pharmacy&rsquo;s extraction issues are the bulk of this table. Both Apollo collectors extract every
          target field correctly against a single URL — verified repeatedly. Under Bright Data&rsquo;s batch mode
          (many URLs per job, what normal ingestion uses for speed), most rows come back with fields null even though
          the row itself returns. Falling back to one collector call per URL helped at first, but a later refresh
          degraded even a single URL that had worked moments earlier — consistent with Apollo&rsquo;s own
          anti-bot/rate-limiting reacting to request volume, not a bug in the extraction logic. Every gap here is a
          logged <code>extraction_issue</code> row, not a silently dropped field.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Coverage</h2>
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Retailer</TableHead>
                  <TableHead>Listings</TableHead>
                  <TableHead>With composition</TableHead>
                  <TableHead>Match status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coverage.map((c) => (
                  <TableRow key={c.retailer}>
                    <TableCell>{c.retailer}</TableCell>
                    <TableCell className="tnum">{c.listings}</TableCell>
                    <TableCell className="tnum">
                      {c.withComposition}/{c.listings}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {Object.entries(c.matchStatusCounts)
                        .map(([status, count]) => `${status} ${count}`)
                        .join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
