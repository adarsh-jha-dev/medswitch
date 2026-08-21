import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { executeTool, TOOL_DEFINITIONS } from "./tools";

const MODEL = process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_ITERATIONS = 5;

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentEvent =
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "text_delta"; delta: string }
  | { type: "error"; message: string };

export interface CompositionSeed {
  fingerprint: string;
  normalizedText: string;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

interface StreamedToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface StreamedTurn {
  content: string;
  toolCalls: StreamedToolCall[];
}

// Tool-call arguments arrive as JSON fragments, not natural language, so only content deltas stream live.
async function streamOneTurn(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  onDelta: (delta: string) => void,
): Promise<StreamedTurn> {
  const stream = await getClient().chat.completions.create({
    model: MODEL,
    messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: "auto",
    stream: true,
  });

  let content = "";
  const toolCallsByIndex = new Map<number, StreamedToolCall>();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      content += delta.content;
      onDelta(delta.content);
    }

    for (const tc of delta.tool_calls ?? []) {
      const existing = toolCallsByIndex.get(tc.index);
      if (existing) {
        if (tc.function?.arguments) existing.arguments += tc.function.arguments;
      } else {
        toolCallsByIndex.set(tc.index, {
          id: tc.id ?? "",
          name: tc.function?.name ?? "",
          arguments: tc.function?.arguments ?? "",
        });
      }
    }
  }

  return { content, toolCalls: [...toolCallsByIndex.values()] };
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
    let turn: StreamedTurn;
    try {
      turn = await streamOneTurn(messages, (delta) => onEvent({ type: "text_delta", delta }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "The assistant is unavailable right now.";
      onEvent({ type: "error", message });
      return "Sorry, something went wrong answering that. Please try again.";
    }

    if (turn.toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: turn.content || null,
        tool_calls: turn.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      for (const call of turn.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          args = {};
        }
        onEvent({ type: "tool_call", name: call.name, args });

        let result: unknown;
        try {
          result = await executeTool(call.name, args);
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "Tool execution failed." };
        }
        onEvent({ type: "tool_result", name: call.name, result });

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    return turn.content;
  }

  const fallback = "I wasn't able to resolve this within my tool budget — please rephrase, or ask your pharmacist directly.";
  onEvent({ type: "text_delta", delta: fallback });
  return fallback;
}
