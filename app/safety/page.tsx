import Link from "next/link";
import { allBannedMatchesGrouped, compositionFingerprintsByIds } from "../../src/queries/banned";
import { formatDate } from "../../src/lib/format";

// No dynamic APIs used, so Next would otherwise prerender this as static.
export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const { confirmed, candidates } = await allBannedMatchesGrouped();
  const fingerprints = await compositionFingerprintsByIds([...confirmed, ...candidates].map((m) => m.compositionId));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Safety</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Every scraped composition checked against the August 2024 CDSCO tranche of 156 prohibited fixed-dose
        combinations (S.O.3285(E) through S.O.3440(E), dated 12.08.2024). A molecule-set match alone is a
        <em> candidate</em>; it is promoted to <em>confirmed</em> only when the notification also states strengths
        and every one matches exactly.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Confirmed ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted">No confirmed matches.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {confirmed.map((m) => {
              const fp = fingerprints.get(m.compositionId);
              const content = (
                <div className="rounded-md bg-confirmed-bg px-5 py-4 text-confirmed-foreground">
                  <p className="text-sm font-semibold">{m.compositionText}</p>
                  <p className="mt-1 text-sm opacity-90">
                    {m.notificationRef}, dated {m.notificationDate ? formatDate(m.notificationDate) : "unknown"} —{" "}
                    {m.status.replace("_", " ")}
                  </p>
                </div>
              );
              return <li key={`${m.bannedFdcId}-${m.compositionId}`}>{fp ? <Link href={`/composition/${fp}`}>{content}</Link> : content}</li>;
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Candidate ({candidates.length})</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">No candidate-only matches.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((m) => {
              const fp = fingerprints.get(m.compositionId);
              const content = (
                <div className="rounded-md border border-candidate-border bg-candidate-bg px-5 py-3">
                  <p className="text-sm font-medium">{m.compositionText}</p>
                  <p className="mt-1 text-xs text-muted">
                    Same molecule set as {m.notificationRef}
                    {m.notificationDate ? ` (${formatDate(m.notificationDate)})` : ""} — {m.status.replace("_", " ")} —
                    strengths not confirmed to match.
                  </p>
                </div>
              );
              return <li key={`${m.bannedFdcId}-${m.compositionId}`}>{fp ? <Link href={`/composition/${fp}`}>{content}</Link> : content}</li>;
            })}
          </ul>
        )}
      </section>

      <p className="mt-10 border-t border-border pt-4 text-xs text-muted">
        Prohibitions can be stayed or quashed by courts after the fact (the 2016 S.O. 814(E) tranche was quashed by
        the Delhi High Court in 2019, appeal still pending) — the notification reference is the legal authority, this
        page is not.
      </p>
    </main>
  );
}
