import type { BannedFdcMatch } from "../queries/banned";
import { formatDate } from "../lib/format";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";

export function BannedNotice({ matches }: { matches: BannedFdcMatch[] }) {
  if (matches.length === 0) return null;

  const confirmed = matches.filter((m) => m.tier === "confirmed");
  const candidates = matches.filter((m) => m.tier === "candidate");

  return (
    <div className="mb-8 flex flex-col gap-3">
      {confirmed.map((m) => (
        <Alert key={m.bannedFdcId} className="border-transparent bg-confirmed-bg text-confirmed-foreground">
          <AlertTitle className="flex items-center gap-2">
            <Badge className="bg-confirmed-foreground text-confirmed-bg">Prohibited</Badge>
            {m.notificationRef}
            {m.notificationDate ? `, dated ${formatDate(m.notificationDate)}` : ""}
          </AlertTitle>
          <AlertDescription className="text-confirmed-foreground/80">
            &ldquo;{m.rawText}&rdquo; — status: {m.status.replace("_", " ")}.
            {m.sourceUrl ? (
              <>
                {" "}
                <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  Read the gazette notification
                </a>
                .
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ))}
      {candidates.map((m) => (
        <Alert key={m.bannedFdcId} className="border-candidate-border bg-candidate-bg">
          <AlertTitle className="flex items-center gap-2 text-danger-text">
            <Badge variant="outline" className="border-danger-text/30 text-danger-text">
              Candidate
            </Badge>
            Same molecule combination as {m.notificationRef}
            {m.notificationDate ? ` (${formatDate(m.notificationDate)})` : ""}
          </AlertTitle>
          <AlertDescription>
            Strengths differ from the prohibited formulation (&ldquo;{m.rawText}&rdquo;), so this is not a confirmed
            match.
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
