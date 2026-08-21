"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

type AgentEvent =
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "text"; text: string }
  | { type: "error"; message: string };

interface Turn {
  role: "user" | "assistant";
  content?: string;
  events?: AgentEvent[];
  pending?: boolean;
}

const TOOL_LABEL: Record<string, string> = {
  find_substitutes: "Finding substitutes",
  check_banned: "Checking banned-FDC status",
  search_notifications: "Searching gazette notifications",
};

function describeCall(name: string, args: Record<string, unknown>): string {
  const label = TOOL_LABEL[name] ?? name;
  const arg = Object.values(args)[0];
  return typeof arg === "string" ? `${label} — "${arg}"` : label;
}

function ToolEvent({ event }: { event: AgentEvent }) {
  if (event.type === "tool_call") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-muted-foreground">
          tool
        </Badge>
        {describeCall(event.name, event.args)}
      </div>
    );
  }
  if (event.type === "tool_result") {
    return (
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">{TOOL_LABEL[event.name] ?? event.name} — result</summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-2 text-[0.7rem] leading-snug">
          {JSON.stringify(event.result, null, 2)}
        </pre>
      </details>
    );
  }
  if (event.type === "error") {
    return <p className="text-xs text-destructive">Error: {event.message}</p>;
  }
  return null;
}

export function AgentChat({
  initialFingerprint,
  initialCompositionText,
  initialQuestion = "",
}: {
  initialFingerprint?: string;
  initialCompositionText?: string;
  initialQuestion?: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;

    const history = turns
      .filter((t) => t.role === "user" || (t.role === "assistant" && t.content))
      .map((t) => ({ role: t.role, content: t.content ?? "" }));

    setTurns((prev) => [...prev, { role: "user", content: message }, { role: "assistant", events: [], pending: true }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          fingerprint: initialFingerprint,
          compositionText: initialCompositionText,
        }),
      });

      if (!res.body) throw new Error("No response body.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event: AgentEvent = JSON.parse(line);
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") return prev;
            const events = [...(last.events ?? []), event];
            const content = event.type === "text" ? event.text : last.content;
            next[next.length - 1] = { ...last, events, content, pending: false };
            return next;
          });
        }
      }
    } catch (err) {
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            pending: false,
            events: [...(last.events ?? []), { type: "error", message: err instanceof Error ? err.message : "Request failed." }],
          };
        }
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {initialFingerprint ? (
        <p className="text-xs text-muted-foreground">
          Scoped to this composition. Ask about its price across retailers or its banned-FDC status.
        </p>
      ) : null}

      <div className="flex min-h-64 flex-col gap-4">
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask about a brand or molecule&apos;s price across retailers, or whether a composition matches a banned
            fixed-dose combination. This assistant compares composition and price only — it will not give dosage,
            interaction, or &ldquo;should I switch&rdquo; advice.
          </p>
        ) : null}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="self-end rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
              {turn.content}
            </div>
          ) : (
            <Card key={i} className="self-start bg-muted/40">
              <CardContent className="flex flex-col gap-2">
                {(turn.events ?? [])
                  .filter((e) => e.type !== "text")
                  .map((e, j) => (
                    <ToolEvent key={j} event={e} />
                  ))}
                {turn.content ? <p className="text-sm whitespace-pre-wrap">{turn.content}</p> : null}
                {turn.pending && !turn.content ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
              </CardContent>
            </Card>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask a question
        </label>
        <Input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What's the cheapest Metformin 500mg across retailers?"
          className="h-10 px-4 text-sm"
          disabled={busy}
        />
        <Button type="submit" size="lg" className="h-10" disabled={busy || !input.trim()}>
          {busy ? "Asking…" : "Ask"}
        </Button>
      </form>
    </div>
  );
}
