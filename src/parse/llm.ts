import { createHash } from "node:crypto";
import { inArray } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { db } from "../db";
import { compositionParseCache } from "../db/schema";
import { dosageForms, releaseModifiers, type ParsedComposition } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BATCH_SIZE = 20;

const componentSchema = z.object({
  molecule: z.string().min(1),
  strengthValue: z.number(),
  // not a closed enum — real labels use units beyond mg/ml/%, e.g. "AU" for enzymes
  strengthUnit: z.string().min(1).max(16),
});

const parsedSchema = z.object({
  components: z.array(componentSchema).min(1),
  dosageForm: z.enum(dosageForms),
  releaseModifier: z.enum(["none", ...releaseModifiers]),
});

// outer shape only — items are validated individually below so one bad item can't null the whole batch
const batchResponseSchema = z.object({
  results: z.array(z.unknown()),
});

export function hashRaw(raw: string): string {
  return createHash("sha256").update(raw.trim().toLowerCase()).digest("hex");
}

const SYSTEM_PROMPT = `You parse Indian pharmacy composition strings into structured data.

Rules:
- Strip pharmacopoeial suffixes like IP, BP, USP — they are not part of the molecule name.
- Keep the salt form as part of the molecule name when it is stated (e.g. "Diclofenac Sodium", "Metformin Hydrochloride"). Do not add a salt that isn't printed.
- Never infer a strength that isn't printed in the string.
- A combination product has one entry per active ingredient in "components".
- If a string cannot be confidently parsed, use null for that item instead of guessing.
- Respond with ONLY a JSON object matching this shape — no commentary:

{"results": [ {"components": [{"molecule": string, "strengthValue": number, "strengthUnit": "mg"|"mcg"|"g"|"ml"|"iu"|"%"|"mg/ml"|"%w/w"}], "dosageForm": one of ${JSON.stringify(dosageForms)}, "releaseModifier": "none" or one of ${JSON.stringify(releaseModifiers)}} | null ]}

The results array must have exactly as many entries as input lines, in the same order.`;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

async function callLlmBatch(rawStrings: string[]): Promise<(ParsedComposition | null)[]> {
  const numbered = rawStrings.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const response = await getClient().chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Parse these ${rawStrings.length} composition strings:\n${numbered}` },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) return rawStrings.map(() => null);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return rawStrings.map(() => null);
  }

  const outer = batchResponseSchema.safeParse(parsedJson);
  if (!outer.success || outer.data.results.length !== rawStrings.length) {
    return rawStrings.map(() => null);
  }

  return outer.data.results.map((item) => {
    if (item === null) return null;
    const result = parsedSchema.safeParse(item);
    if (!result.success) return null;
    const data = result.data;
    return {
      components: data.components.map((c) => ({
        rawName: c.molecule,
        strengthValue: c.strengthValue,
        strengthUnit: c.strengthUnit.trim().toLowerCase(),
      })),
      dosageForm: data.dosageForm,
      dosageFormInferred: false,
      releaseModifier: data.releaseModifier === "none" ? null : data.releaseModifier,
    };
  });
}

export async function parseWithLlm(rawStrings: string[]): Promise<Map<string, ParsedComposition | null>> {
  const results = new Map<string, ParsedComposition | null>();
  const distinct = [...new Set(rawStrings)];
  if (distinct.length === 0) return results;

  const hashes = distinct.map(hashRaw);
  const cached = await db
    .select()
    .from(compositionParseCache)
    .where(inArray(compositionParseCache.rawHash, hashes));
  const cacheByHash = new Map(cached.map((c) => [c.rawHash, c.parsed as ParsedComposition | null]));

  const uncached: string[] = [];
  for (const raw of distinct) {
    const hash = hashRaw(raw);
    if (cacheByHash.has(hash)) {
      results.set(raw, cacheByHash.get(hash) ?? null);
    } else {
      uncached.push(raw);
    }
  }

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const parsed = await callLlmBatch(batch);
    for (let j = 0; j < batch.length; j++) {
      const raw = batch[j];
      const value = parsed[j];
      results.set(raw, value);
      await db
        .insert(compositionParseCache)
        .values({ rawHash: hashRaw(raw), rawText: raw, parsed: value, method: "llm", model: MODEL })
        .onConflictDoNothing({ target: compositionParseCache.rawHash });
    }
  }

  return results;
}
