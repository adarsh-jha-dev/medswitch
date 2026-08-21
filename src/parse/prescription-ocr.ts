import OpenAI from "openai";
import { z } from "zod";

// Cheap vision-capable chat model — same tier choice as llm.ts and embed.ts.
const MODEL = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

const extractedItemSchema = z.object({
  rawText: z.string().min(1), // verbatim as printed/handwritten, for the user to verify or correct
  brandGuess: z.string().nullable(),
  strengthGuess: z.string().nullable(),
  confidence: z.enum(["high", "low"]),
});

const extractionResponseSchema = z.object({
  items: z.array(extractedItemSchema),
});

export type ExtractedPrescriptionItem = z.infer<typeof extractedItemSchema>;

const SYSTEM_PROMPT = `You read photos of Indian pharmacy prescriptions, medicine strips, and boxes.

Rules:
- List one entry per distinct medicine line you can see.
- "rawText" must be your best verbatim transcription of that line, exactly as printed or written —
  this is shown to the user so they can correct you if you misread it. Never paraphrase it.
- "brandGuess" is the brand or product name only, without strength (null if illegible).
- "strengthGuess" is the strength/dose as printed (e.g. "40mg", "500mg"), null if not visible.
- "confidence" is "low" for handwriting, partial visibility, or any real uncertainty — do not mark
  something "high" just because you produced an answer.
- Never invent a medicine that isn't visible in the image.
- Respond with ONLY a JSON object: {"items": [{"rawText": string, "brandGuess": string|null, "strengthGuess": string|null, "confidence": "high"|"low"}]}`;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

// Image is passed through in memory only (base64 data URL) — never written
// to disk or the database, and discarded once this call returns.
export async function extractPrescriptionItems(imageDataUrl: string): Promise<ExtractedPrescriptionItem[]> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract every medicine line visible in this image." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) return [];

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return [];
  }

  const result = extractionResponseSchema.safeParse(parsedJson);
  return result.success ? result.data.items : [];
}
