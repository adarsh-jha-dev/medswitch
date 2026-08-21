import Link from "next/link";
import { redirect } from "next/navigation";
import { listSubstitutionGroups, searchProducts } from "../../src/queries/substitution";
import { Badge } from "../../src/components/ui/badge";
import { Card, CardContent } from "../../src/components/ui/card";
import { SearchBox } from "../../src/components/search-box";

async function SearchResults({ q }: { q: string }) {
  const results = await searchProducts(q);

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matches for &ldquo;{q}&rdquo;. Try a brand name (e.g. &ldquo;Glycomet&rdquo;) or a molecule (e.g. &ldquo;Metformin&rdquo;).
      </p>
    );
  }

  if (results.length === 1) {
    redirect(`/composition/${results[0].fingerprintHash}`);
  }

  return (
    <div className="flex flex-col gap-2">
      {results.map((r) => (
        <Link key={r.fingerprintHash} href={`/composition/${r.fingerprintHash}`}>
          <Card className="bg-muted/40 transition-colors hover:border-brand/40">
            <CardContent className="flex items-center justify-between gap-4">
              <span className="text-sm">{r.normalizedText}</span>
              <Badge variant="outline">{r.matchedOn}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

async function Featured() {
  const [camylofin, groups] = await Promise.all([searchProducts("camylofin"), listSubstitutionGroups()]);

  const topSavings = groups
    .filter((g) => g.savingsPct !== null && g.retailerCount >= 2)
    .sort((a, b) => (b.savingsPct ?? 0) - (a.savingsPct ?? 0))
    .slice(0, 2);

  return (
    <div className="mt-10">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Worth a look</p>
      <div className="flex flex-col gap-2">
        {camylofin[0] ? (
          <Link href={`/composition/${camylofin[0].fingerprintHash}`}>
            <Card className="border-candidate-border bg-candidate-bg transition-colors hover:border-brand/50">
              <CardContent className="text-sm">
                <Badge variant="outline" className="mb-1.5 border-danger-text/30 text-danger-text">
                  Confirmed banned-FDC match
                </Badge>
                <p>{camylofin[0].normalizedText}</p>
              </CardContent>
            </Card>
          </Link>
        ) : null}
        {topSavings.map((g) => (
          <Link key={g.fingerprintHash} href={`/composition/${g.fingerprintHash}`}>
            <Card className="transition-colors hover:border-brand/40">
              <CardContent className="text-sm">
                {g.normalizedText} — <span className="tnum font-medium text-brand">{g.savingsPct}% cheaper</span> at the
                cheapest listed retailer
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <main className="mx-auto my-10 w-full max-w-2xl rounded-2xl border border-border bg-surface px-6 py-12 shadow-sm sm:px-10 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <p className="mt-2 text-muted-foreground">Compare Indian pharmacy prices for the same composition, across retailers.</p>

      <SearchBox initialQuery={query} />

      <div className="mt-8">{query ? <SearchResults q={query} /> : <Featured />}</div>
    </main>
  );
}
