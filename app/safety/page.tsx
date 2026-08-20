import Link from "next/link";
import { allBannedMatchesGrouped, compositionFingerprintsByIds } from "../../src/queries/banned";
import { formatDate } from "../../src/lib/format";
import { Alert, AlertDescription, AlertTitle } from "../../src/components/ui/alert";
import { Badge } from "../../src/components/ui/badge";

// No dynamic APIs used, so Next would otherwise prerender this as static.
export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const { confirmed, candidates } = await allBannedMatchesGrouped();
  const fingerprints = await compositionFingerprintsByIds([...confirmed, ...candidates].map((m) => m.compositionId));

  return (
    <main className="mx-auto my-10 w-full max-w-4xl rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Safety</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every scraped composition checked against the August 2024 CDSCO tranche of 156 prohibited fixed-dose
        combinations (S.O.3285(E) through S.O.3440(E), dated 12.08.2024). A molecule-set match alone is a
        <em> candidate</em>; it is promoted to <em>confirmed</em> only when the notification also states strengths
        and every one matches exactly.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Confirmed ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed matches.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {confirmed.map((m) => {
              const fp = fingerprints.get(m.compositionId);
              const alert = (
                <Alert className="border-transparent bg-confirmed-bg text-confirmed-foreground">
                  <AlertTitle>{m.compositionText}</AlertTitle>
                  <AlertDescription className="text-confirmed-foreground/80">
                    {m.notificationRef}, dated {m.notificationDate ? formatDate(m.notificationDate) : "unknown"} —{" "}
                    {m.status.replace("_", " ")}
                  </AlertDescription>
                </Alert>
              );
              return <div key={`${m.bannedFdcId}-${m.compositionId}`}>{fp ? <Link href={`/composition/${fp}`}>{alert}</Link> : alert}</div>;
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Candidate ({candidates.length})</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No candidate-only matches.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {candidates.map((m) => {
              const fp = fingerprints.get(m.compositionId);
              const alert = (
                <Alert className="border-candidate-border bg-candidate-bg">
                  <AlertTitle className="flex items-center gap-2">
                    {m.compositionText}
                    <Badge variant="outline" className="border-danger-text/30 text-danger-text">
                      candidate
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>
                    Same molecule set as {m.notificationRef}
                    {m.notificationDate ? ` (${formatDate(m.notificationDate)})` : ""} — {m.status.replace("_", " ")} —
                    strengths not confirmed to match.
                  </AlertDescription>
                </Alert>
              );
              return <div key={`${m.bannedFdcId}-${m.compositionId}`}>{fp ? <Link href={`/composition/${fp}`}>{alert}</Link> : alert}</div>;
            })}
          </div>
        )}
      </section>

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
        Prohibitions can be stayed or quashed by courts after the fact (the 2016 S.O. 814(E) tranche was quashed by
        the Delhi High Court in 2019, appeal still pending) — the notification reference is the legal authority, this
        page is not.
      </p>
    </main>
  );
}
