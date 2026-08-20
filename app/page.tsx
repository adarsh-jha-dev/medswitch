import Link from "next/link";
import { redirect } from "next/navigation";
import { listSubstitutionGroups, searchProducts } from "../src/queries/substitution";

const QUICK_LINKS = ["Telma AM", "Glycomet", "Camylofin"];

async function SearchResults({ q }: { q: string }) {
  const results = await searchProducts(q);

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted">
        No matches for &ldquo;{q}&rdquo;. Try a brand name (e.g. &ldquo;Glycomet&rdquo;) or a molecule (e.g. &ldquo;Metformin&rdquo;).
      </p>
    );
  }

  if (results.length === 1) {
    redirect(`/composition/${results[0].fingerprintHash}`);
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-t border-border">
      {results.map((r) => (
        <li key={r.fingerprintHash}>
          <Link href={`/composition/${r.fingerprintHash}`} className="flex items-center justify-between gap-4 py-3 hover:text-accent">
            <span className="text-sm">{r.normalizedText}</span>
            <span className="text-xs text-muted">matched &ldquo;{r.matchedOn}&rdquo;</span>
          </Link>
        </li>
      ))}
    </ul>
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
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Worth a look</p>
      <div className="flex flex-col gap-2">
        {camylofin[0] ? (
          <Link
            href={`/composition/${camylofin[0].fingerprintHash}`}
            className="rounded-md border border-candidate-border bg-candidate-bg px-4 py-3 text-sm hover:border-accent"
          >
            <span className="font-medium text-danger-text">Confirmed banned-FDC match</span> — {camylofin[0].normalizedText}
          </Link>
        ) : null}
        {topSavings.map((g) => (
          <Link
            key={g.fingerprintHash}
            href={`/composition/${g.fingerprintHash}`}
            className="rounded-md border border-border px-4 py-3 text-sm hover:border-accent"
          >
            {g.normalizedText} — <span className="tnum font-medium text-accent">{g.savingsPct}% cheaper</span> at the
            cheapest listed retailer
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">MedSwitch</h1>
      <p className="mt-2 text-muted">Compare Indian pharmacy prices for the same composition, across retailers.</p>

      <form action="/" method="GET" className="mt-8 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Brand name (Telma AM) or molecule (Metformin)"
          className="flex-1 rounded-md border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
          autoFocus
        />
        <button type="submit" className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background">
          Search
        </button>
      </form>

      <div className="mt-3 flex gap-3 text-xs text-muted">
        {QUICK_LINKS.map((term) => (
          <Link key={term} href={`/?q=${encodeURIComponent(term)}`} className="hover:text-accent">
            {term}
          </Link>
        ))}
      </div>

      <div className="mt-8">{query ? <SearchResults q={query} /> : <Featured />}</div>
    </main>
  );
}
