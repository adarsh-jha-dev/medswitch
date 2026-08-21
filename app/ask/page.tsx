import { getSubstitutionGroup } from "../../src/queries/substitution";
import { AgentChat } from "../../src/components/agent-chat";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ fingerprint?: string }>;
}) {
  const { fingerprint } = await searchParams;
  const group = fingerprint ? await getSubstitutionGroup(fingerprint) : null;

  return (
    <main className="mx-auto my-10 w-full max-w-2xl rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Ask MedSwitch</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {group ? `Scoped to ${group.normalizedText}.` : "Compare prices, or check a composition against the banned-FDC list."}
      </p>

      <div className="mt-8">
        <AgentChat
          initialFingerprint={group?.fingerprintHash}
          initialCompositionText={group?.normalizedText}
          initialQuestion={group ? `What's the cheapest option for ${group.normalizedText}, and is it a banned combination?` : ""}
        />
      </div>
    </main>
  );
}
