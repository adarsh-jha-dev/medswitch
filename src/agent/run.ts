import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { executeTool, TOOL_DEFINITIONS } from "./tools";

// Deliberately the cheap chat model — same choice as src/parse/llm.ts. This
// agent's job is constrained tool orchestration, not open-ended reasoning.
const MODEL = process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_ITERATIONS = 5;

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentEvent =
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "text"; text: string }
  | { type: "error"; message: string };

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

// Non-streaming under the hood (tool-calling turns can't stream usefully
// anyway) but events are emitted as they happen, so a caller can render
// "find_substitutes fired, then check_banned, then the answer" as it unfolds.
export interface CompositionSeed {
  fingerprint: string;
  normalizedText: string;
}

export async function runAgentTurn(
  history: AgentMessage[],
  userMessage: string,
  onEvent: (event: AgentEvent) => void,
  seed?: CompositionSeed,
): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(
      (h): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({ role: h.role, content: h.content }),
    ),
  ];

  const seededMessage = seed
    ? `[This conversation is scoped to the composition "${seed.normalizedText}" (compositionFingerprint: ${seed.fingerprint}). Use that compositionFingerprint directly with find_substitutes and check_banned rather than searching by name.]\n${userMessage}`
    : userMessage;
  messages.push({ role: "user", content: seededMessage });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await getClient().chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The assistant is unavailable right now.";
      onEvent({ type: "error", message });
      return "Sorry, something went wrong answering that. Please try again.";
    }

    const choice = response.choices[0];
    const msg = choice?.message;
    if (!msg) {
      const fallback = "Sorry, something went wrong answering that. Please try again.";
      onEvent({ type: "text", text: fallback });
      return fallback;
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        onEvent({ type: "tool_call", name: call.function.name, args });

        let result: unknown;
        try {
          result = await executeTool(call.function.name, args);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "Tool execution failed." };
        }
        onEvent({ type: "tool_result", name: call.function.name, result });

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    const text = msg.content ?? "";
    onEvent({ type: "text", text });
    return text;
  }

  const fallback = "I wasn't able to resolve this within my tool budget — please rephrase, or ask your pharmacist directly.";
  onEvent({ type: "text", text: fallback });
  return fallback;
}
