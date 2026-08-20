import { collectorRuns, extractionIssuesByFieldAndRetailer, healEvents, retailerCoverage } from "../../src/queries/ops";
import { formatDateTime } from "../../src/lib/format";

// No dynamic APIs used, so Next would otherwise prerender this as static.
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [heals, runs, issues, coverage] = await Promise.all([
    healEvents(),
    collectorRuns(),
    extractionIssuesByFieldAndRetailer(),
    retailerCoverage(),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Pipeline health</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Every heal, run, and extraction gap is logged rather than silently patched — this page is that log, not a
        polished summary of it.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Heal log ({heals.length})</h2>
        <ul className="flex flex-col gap-3">
          {heals.map((h) => (
            <li key={h.id} className="rounded-md border border-border px-4 py-3">
              <p className="text-sm font-medium">
                {h.collectorId}
                {h.fieldName ? ` · ${h.fieldName}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">{h.symptom}</p>
              {h.rowsBefore !== null && h.rowsAfter !== null ? (
                <p className="tnum mt-1 text-sm">
                  {h.rowsBefore} → {h.rowsAfter} rows
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted">detected {formatDateTime(h.detectedAt)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Run history ({runs.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 pr-4 font-medium">Retailer</th>
                <th className="pb-2 pr-4 font-medium">Collector</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Expected</th>
                <th className="pb-2 pr-4 font-medium">Returned</th>
                <th className="pb-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4">{r.retailer}</td>
                  <td className="py-2 pr-4 text-muted">{r.collectorId}</td>
                  <td className="py-2 pr-4">{r.status}</td>
                  <td className="tnum py-2 pr-4">{r.rowsExpected}</td>
                  <td className="tnum py-2 pr-4">{r.rowsReturned}</td>
                  <td className="tnum py-2">{r.durationSeconds !== null ? `${r.durationSeconds}s` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Extraction issues ({issues.reduce((n, i) => n + i.count, 0)})</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 pr-4 font-medium">Retailer</th>
                <th className="pb-2 pr-4 font-medium">Field</th>
                <th className="pb-2 font-medium">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {issues.map((i) => (
                <tr key={`${i.retailer}-${i.fieldName}`}>
                  <td className="py-2 pr-4">{i.retailer}</td>
                  <td className="py-2 pr-4 text-muted">{i.fieldName}</td>
                  <td className="tnum py-2">{i.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-2xl text-sm text-muted">
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 pr-4 font-medium">Retailer</th>
                <th className="pb-2 pr-4 font-medium">Listings</th>
                <th className="pb-2 pr-4 font-medium">With composition</th>
                <th className="pb-2 font-medium">Match status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coverage.map((c) => (
                <tr key={c.retailer}>
                  <td className="py-2 pr-4">{c.retailer}</td>
                  <td className="tnum py-2 pr-4">{c.listings}</td>
                  <td className="tnum py-2 pr-4">
                    {c.withComposition}/{c.listings}
                  </td>
                  <td className="py-2 text-muted">
                    {Object.entries(c.matchStatusCounts)
                      .map(([status, count]) => `${status} ${count}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
