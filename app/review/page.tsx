import { pendingMatches, pendingMerges } from "../../src/queries/review";
import { approveMatch, approveMerge, rejectMatch, rejectMerge } from "./actions";
import { Badge } from "../../src/components/ui/badge";
import { Button } from "../../src/components/ui/button";
import { Card, CardContent } from "../../src/components/ui/card";

// The queue can grow from a backend pnpm parse re-run, not only from actions on this page.
export const dynamic = "force-dynamic";

function ActionButtons({ approve, reject }: { approve: () => Promise<void>; reject: () => Promise<void> }) {
  return (
    <div className="flex shrink-0 gap-2">
      <form action={approve}>
        <Button type="submit" size="sm">
          Approve
        </Button>
      </form>
      <form action={reject}>
        <Button type="submit" size="sm" variant="destructive">
          Reject
        </Button>
      </form>
    </div>
  );
}

export default async function ReviewPage() {
  const [matches, merges] = await Promise.all([pendingMatches(), pendingMerges()]);

  return (
    <main className="mx-auto my-10 w-full max-w-4xl rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Nothing here was auto-matched or auto-merged. A human approves before it counts toward a price comparison or
        a molecule identity.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Matches ({matches.length})</h2>
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <Card key={m.listingId}>
              <CardContent className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {m.retailer} · {m.brandName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Raw: {m.rawCompositionText ?? "(none)"}</p>
                  <p className="text-sm text-muted-foreground">Resolved: {m.resolvedCompositionText ?? "(unresolved)"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {m.matchConfidence !== null ? (
                      <Badge variant="secondary" className="tnum">
                        confidence {m.matchConfidence.toFixed(2)}
                      </Badge>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{m.reason}</p>
                  </div>
                </div>
                <ActionButtons approve={approveMatch.bind(null, m.listingId)} reject={rejectMatch.bind(null, m.listingId)} />
              </CardContent>
            </Card>
          ))}
          {matches.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending.</p> : null}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Merges ({merges.length})</h2>
        <div className="flex flex-col gap-3">
          {merges.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {s.moleculeAName} <span className="text-muted-foreground">≈</span> {s.moleculeBName}
                  </p>
                  <Badge variant="secondary" className="tnum mt-2">
                    trigram similarity {s.similarity.toFixed(3)}
                  </Badge>
                </div>
                <ActionButtons approve={approveMerge.bind(null, s.id)} reject={rejectMerge.bind(null, s.id)} />
              </CardContent>
            </Card>
          ))}
          {merges.length === 0 ? <p className="text-sm text-muted-foreground">Nothing pending.</p> : null}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          This queue is trigram-similarity candidates at a 0.7 threshold, not a complete list of typo duplicates.
          &ldquo;Glimepiride&rdquo; vs &ldquo;Glimipride&rdquo; scores 0.44 — an e/i transposition trigram similarity
          structurally struggles with on short words — so it never surfaces here. A threshold low enough to catch it
          pulls in clearly-different drugs as noise, so this is left as a documented gap rather than force-fit.
        </p>
      </section>
    </main>
  );
}
