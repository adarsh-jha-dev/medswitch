import { runAgentTurn, type AgentEvent, type AgentMessage, type CompositionSeed } from "../../../src/agent/run";

// Uses the postgres.js driver (via the query layer), so this needs the
// Node runtime, not edge.
export const runtime = "nodejs";

interface AgentRequestBody {
  message?: string;
  history?: AgentMessage[];
  fingerprint?: string;
  compositionText?: string;
}

function isAgentMessage(v: unknown): v is AgentMessage {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
}

export async function POST(req: Request) {
  let body: AgentRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return new Response(JSON.stringify({ error: "message is required." }), { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history.filter(isAgentMessage).slice(-20) : [];
  const seed: CompositionSeed | undefined =
    typeof body.fingerprint === "string" && typeof body.compositionText === "string"
      ? { fingerprint: body.fingerprint, normalizedText: body.compositionText }
      : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await runAgentTurn(history, message, send, seed);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Agent failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
