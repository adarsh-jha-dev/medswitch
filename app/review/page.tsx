import { pendingMatches, pendingMerges } from "../../src/queries/review";
import { approveMatch, approveMerge, rejectMatch, rejectMerge } from "./actions";

// No dynamic APIs used, so Next would otherwise prerender this as static.
export const dynamic = "force-dynamic";

function ActionButtons({ approve, reject }: { approve: () => Promise<void>; reject: () => Promise<void> }) {
  return (
    <div className="flex gap-2">
      <form action={approve}>
        <button type="submit" className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background">
          Approve
        </button>
      </form>
      <form action={reject}>
        <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted">
          Reject
        </button>
      </form>
    </div>
  );
}

export default async function ReviewPage() {
  const [matches, merges] = await Promise.all([pendingMatches(), pendingMerges()]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Nothing here was auto-matched or auto-merged. A human approves before it counts toward a price comparison or
        a molecule identity.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Matches ({matches.length})</h2>
        <ul className="flex flex-col gap-3">
          {matches.map((m) => (
            <li key={m.listingId} className="rounded-md border border-border px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {m.retailer} · {m.brandName}
                  </p>
                  <p className="mt-1 text-sm text-muted">Raw: {m.rawCompositionText ?? "(none)"}</p>
                  <p className="text-sm text-muted">Resolved: {m.resolvedCompositionText ?? "(unresolved)"}</p>
                  <p className="mt-1 text-xs text-muted">
                    {m.matchConfidence !== null ? `confidence ${m.matchConfidence.toFixed(2)} — ` : ""}
                    {m.reason}
                  </p>
                </div>
                <ActionButtons approve={approveMatch.bind(null, m.listingId)} reject={rejectMatch.bind(null, m.listingId)} />
              </div>
            </li>
          ))}
          {matches.length === 0 ? <p className="text-sm text-muted">Nothing pending.</p> : null}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Merges ({merges.length})</h2>
        <ul className="flex flex-col gap-3">
          {merges.map((s) => (
            <li key={s.id} className="rounded-md border border-border px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {s.moleculeAName} <span className="text-muted">≈</span> {s.moleculeBName}
                  </p>
                  <p className="tnum mt-1 text-xs text-muted">trigram similarity {s.similarity.toFixed(3)}</p>
                </div>
                <ActionButtons approve={approveMerge.bind(null, s.id)} reject={rejectMerge.bind(null, s.id)} />
              </div>
            </li>
          ))}
          {merges.length === 0 ? <p className="text-sm text-muted">Nothing pending.</p> : null}
        </ul>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          This queue is trigram-similarity candidates at a 0.7 threshold, not a complete list of typo duplicates.
          &ldquo;Glimepiride&rdquo; vs &ldquo;Glimipride&rdquo; scores 0.44 — an e/i transposition trigram similarity
          structurally struggles with on short words — so it never surfaces here. A threshold low enough to catch it
          pulls in clearly-different drugs as noise, so this is left as a documented gap rather than force-fit.
        </p>
      </section>
    </main>
  );
}
