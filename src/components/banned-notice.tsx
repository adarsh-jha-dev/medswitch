import type { BannedFdcMatch } from "../queries/banned";
import { formatDate } from "../lib/format";

export function BannedNotice({ matches }: { matches: BannedFdcMatch[] }) {
  if (matches.length === 0) return null;

  const confirmed = matches.filter((m) => m.tier === "confirmed");
  const candidates = matches.filter((m) => m.tier === "candidate");

  return (
    <div className="mb-8 flex flex-col gap-3">
      {confirmed.map((m) => (
        <div key={m.bannedFdcId} className="rounded-md bg-confirmed-bg px-5 py-4 text-confirmed-foreground">
          <p className="text-sm font-semibold">
            Prohibited under {m.notificationRef}
            {m.notificationDate ? `, dated ${formatDate(m.notificationDate)}` : ""}
          </p>
          <p className="mt-1 text-sm opacity-90">
            Notification text: &ldquo;{m.rawText}&rdquo; — status: {m.status.replace("_", " ")}.
            {m.sourceUrl ? (
              <>
                {" "}
                <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  Read the gazette notification
                </a>
                .
              </>
            ) : null}
          </p>
        </div>
      ))}
      {candidates.map((m) => (
        <div key={m.bannedFdcId} className="rounded-md border border-candidate-border bg-candidate-bg px-5 py-4">
          <p className="text-sm font-medium text-danger-text">
            Same molecule combination as banned item {m.notificationRef}
            {m.notificationDate ? ` (${formatDate(m.notificationDate)})` : ""}; strengths differ from the prohibited
            formulation, so this is not a confirmed match.
          </p>
          <p className="mt-1 text-sm text-muted">Prohibited formulation: &ldquo;{m.rawText}&rdquo;.</p>
        </div>
      ))}
    </div>
  );
}
