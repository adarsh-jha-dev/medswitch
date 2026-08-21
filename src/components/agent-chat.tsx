"use client";

import { FileSearch, Search, ShieldAlert, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type AgentEvent =
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "text_delta"; delta: string }
  | { type: "error"; message: string };

interface Turn {
  role: "user" | "assistant";
  content?: string;
  events?: AgentEvent[];
  pending?: boolean;
}

interface ToolStep {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

const TOOL_LABEL: Record<string, string> = {
  find_substitutes: "Finding substitutes",
  check_banned: "Checking banned-FDC status",
  search_notifications: "Searching gazette notifications",
};

const TOOL_ICON: Record<string, LucideIcon> = {
  find_substitutes: Search,
  check_banned: ShieldAlert,
  search_notifications: FileSearch,
};

// Fingerprint hashes are 64-char hex — not useful to show a human, so the
// first non-hash-looking string argument (if any) is what gets displayed.
function describeArgs(args: Record<string, unknown>): string | null {
  for (const value of Object.values(args)) {
    if (typeof value === "string" && value.length > 0 && !/^[0-9a-f]{16,64}$/i.test(value)) {
      return value;
    }
  }
  return null;
}

function groupToolSteps(events: AgentEvent[]): ToolStep[] {
  const steps: ToolStep[] = [];
  for (const e of events) {
    if (e.type === "tool_call") {
      steps.push({ name: e.name, args: e.args });
    } else if (e.type === "tool_result") {
      const step = [...steps].reverse().find((s) => s.name === e.name && s.result === undefined);
      if (step) step.result = e.result;
    }
  }
  return steps;
}

function ToolStepChip({ step }: { step: ToolStep }) {
  const Icon = TOOL_ICON[step.name] ?? Search;
  const label = TOOL_LABEL[step.name] ?? step.name;
  const detail = describeArgs(step.args);

  return (
    <details className="rounded-2xl border border-border bg-background/70 text-xs open:w-full">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">
          {label}
          {detail ? ` — "${detail}"` : ""}
        </span>
        {step.result === undefined ? <span className="animate-pulse">…</span> : null}
      </summary>
      {step.result !== undefined ? (
        <pre className="max-h-56 overflow-auto rounded-b-2xl bg-muted p-2 text-[0.7rem] leading-snug">
          {JSON.stringify(step.result, null, 2)}
        </pre>
      ) : null}
    </details>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand underline underline-offset-2 hover:text-brand/80"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em]">{children}</code>,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border bg-muted px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b border-border px-2 py-1 align-top">{children}</td>,
};

function AssistantTurn({ turn }: { turn: Turn }) {
  const steps = groupToolSteps(turn.events ?? []);
  const errors = (turn.events ?? []).filter((e): e is { type: "error"; message: string } => e.type === "error");
  const showThinking = turn.pending && !turn.content && steps.length === 0;

  return (
    <div className="flex max-w-[85%] flex-col gap-2 self-start">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">MedSwitch</p>

      {steps.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {steps.map((step, i) => (
            <ToolStepChip key={i} step={step} />
          ))}
        </div>
      ) : null}

      {showThinking ? <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p> : null}

      {turn.content ? (
        <div className="text-sm text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {turn.content}
          </ReactMarkdown>
          {turn.pending ? <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-foreground/50 align-middle" /> : null}
        </div>
      ) : null}

      {errors.map((e, i) => (
        <p key={i} className="text-xs text-destructive">
          {e.message}
        </p>
      ))}
    </div>
  );
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
            const content = event.type === "text_delta" ? (last.content ?? "") + event.delta : last.content;
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
            events: [...(last.events ?? []), { type: "error", message: err instanceof Error ? err.message : "Request failed." }],
          };
        }
        return next;
      });
    } finally {
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, pending: false };
        return next;
      });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {initialFingerprint ? (
        <p className="text-xs text-muted-foreground">
          Scoped to this composition. Ask about its price across retailers or its banned-FDC status.
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="flex max-h-136 min-h-72 flex-col gap-5 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask about a brand or molecule&apos;s price across retailers, or whether a composition matches a banned
            fixed-dose combination. This assistant compares composition and price only — it will not give dosage,
            interaction, or &ldquo;should I switch&rdquo; advice.
          </p>
        ) : null}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              {turn.content}
            </div>
          ) : (
            <AssistantTurn key={i} turn={turn} />
          ),
        )}
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
