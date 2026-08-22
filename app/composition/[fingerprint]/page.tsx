import Link from "next/link";
import { notFound } from "next/navigation";
import { bannedMatchesByCompositionId } from "../../../src/queries/banned";
import { nearestKendras } from "../../../src/queries/kendra";
import { computeSavings, getSubstitutionGroup } from "../../../src/queries/substitution";
import { BannedNotice } from "../../../src/components/banned-notice";
import { CopyLinkButton } from "../../../src/components/copy-link-button";
import { NearestKendraList } from "../../../src/components/nearest-kendra";
import { PriceTable } from "../../../src/components/price-table";
import { SafetyLine } from "../../../src/components/safety-line";
import { SavingsCallout } from "../../../src/components/savings-callout";
import { Badge } from "../../../src/components/ui/badge";
import { Button } from "../../../src/components/ui/button";
import { formatStrength } from "../../../src/lib/format";

export default async function CompositionPage({ params }: { params: Promise<{ fingerprint: string }> }) {
  const { fingerprint } = await params;
  const group = await getSubstitutionGroup(fingerprint);
  if (!group) notFound();

  const bannedMatches = await bannedMatchesByCompositionId(group.compositionId);
  const savings = computeSavings(group.ranked);
  const hasJanAushadhi = group.ranked.some((l) => l.retailerSlug === "janaushadhi");
  const kendras = hasJanAushadhi ? await nearestKendras(process.env.SCRAPE_PINCODE ?? "700001") : [];

  return (
    <main className="mx-auto my-10 w-full max-w-4xl rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {group.dosageForm}
          {group.releaseModifier ? `, ${group.releaseModifier}` : ""}
        </p>
        <CopyLinkButton />
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{group.normalizedText}</h1>
      <div className="mt-3 mb-8 flex flex-wrap gap-2">
        {group.molecules.map((m) => (
          <Badge key={m.name} variant="outline" className="text-muted-foreground">
            {m.name} {formatStrength(m.strengthValue, m.strengthUnit)}
          </Badge>
        ))}
      </div>

      <BannedNotice matches={bannedMatches} />

      {savings ? <SavingsCallout savings={savings} /> : null}

      <PriceTable ranked={group.ranked} pendingReview={group.pendingReview} />

      <NearestKendraList kendras={kendras} />

      <div className="mt-6 mb-8">
        <Button asChild variant="outline" size="sm">
          <Link href={`/ask?fingerprint=${group.fingerprintHash}`}>Ask about this composition</Link>
        </Button>
      </div>

      <SafetyLine />
    </main>
  );
}
