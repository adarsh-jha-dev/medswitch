import Link from "next/link";
import { ArrowRight, MessageCircle, ScanLine, Search, ShieldCheck } from "lucide-react";
import { getLandingStats } from "../src/queries/landing";
import { Button } from "../src/components/ui/button";
import { Card, CardContent } from "../src/components/ui/card";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    href: "/search",
    icon: Search,
    title: "Search",
    description: "Look up a brand or molecule and see ranked prices across retailers.",
  },
  {
    href: "/ask",
    icon: MessageCircle,
    title: "Ask",
    description: "A scoped assistant for price and banned-FDC questions — never dosage advice.",
  },
  {
    href: "/scan",
    icon: ScanLine,
    title: "Scan",
    description: "Photograph a prescription and get a substitution table with combined savings.",
  },
  {
    href: "/safety",
    icon: ShieldCheck,
    title: "Safety",
    description: "Every composition checked against the CDSCO banned fixed-dose combination list.",
  },
] as const;

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-2 text-center">
      <p className="tnum text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function LandingPage() {
  const stats = await getLandingStats();

  return (
    <main className="mx-auto w-full max-w-5xl px-6">
      <section className="flex flex-col items-center gap-6 py-24 text-center sm:py-28">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Price transparency for Indian pharmacies
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          The same medicine, compared honestly across retailers.
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground sm:text-lg">
          MedSwitch matches the exact composition — same molecules, same strength, same dosage form — and ranks real
          prices per unit, with every number traceable to its source and capture date.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-6">
            <Link href="/search">
              Compare prices <ArrowRight className="size-4" />
            </Link>
          </Button>
          {process.env.NEXT_PUBLIC_SHOW_LLM_FEATURES === "true" && (
            <Button asChild variant="outline" size="lg" className="h-11 px-6">
              <Link href="/ask">Ask MedSwitch</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-center gap-x-2 gap-y-4 border-y border-border py-8">
        <StatTile value={stats.totalListings.toLocaleString("en-IN")} label="listings tracked" />
        <StatTile value={String(stats.retailerCount)} label="retailers compared" />
        <StatTile value={String(stats.crossRetailerGroups)} label="cross-retailer matches" />
        <StatTile value={String(stats.confirmedBanned)} label="confirmed banned-FDC hits" />
      </section>

      {stats.topSaving ? (
        <section className="py-16">
          <Link href={`/composition/${stats.topSaving.fingerprintHash}`}>
            <Card className="bg-brand-tint transition-colors hover:border-brand/40">
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Real example</p>
                  <p className="mt-1 text-lg font-medium">{stats.topSaving.normalizedText}</p>
                </div>
                <p className="tnum text-3xl font-semibold text-brand">{stats.topSaving.savingsPct}% cheaper</p>
              </CardContent>
            </Card>
          </Link>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href}>
            <Card className="h-full transition-colors hover:border-brand/40">
              <CardContent className="flex flex-col gap-3">
                <f.icon className="size-5 text-brand" />
                <p className="font-medium">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Substitution is a decision for your doctor or pharmacist. MedSwitch compares composition and price, not
        clinical suitability.
      </footer>
    </main>
  );
}
