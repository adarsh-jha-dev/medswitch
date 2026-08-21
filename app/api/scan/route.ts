import { computeSavings, resolveSubstitutionGroup } from "../../../src/queries/substitution";
import { extractPrescriptionItems } from "../../../src/parse/prescription-ocr";

// Uses the postgres.js driver (via the query layer), so this needs the
// Node runtime, not edge.
export const runtime = "nodejs";

interface ScanRequestBody {
  imageDataUrl?: string;
}

export async function POST(req: Request) {
  let body: ScanRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400 });
  }

  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  if (!imageDataUrl.startsWith("data:image/")) {
    return new Response(JSON.stringify({ error: "imageDataUrl must be a data:image/* URL." }), { status: 400 });
  }

  // The image lives only in this request's memory — extracted here, then
  // discarded; nothing about it is written to disk or the database.
  const extracted = await extractPrescriptionItems(imageDataUrl);

  const items = await Promise.all(
    extracted.map(async (item) => {
      const query = item.brandGuess ?? item.rawText;
      const group = query ? await resolveSubstitutionGroup(query) : null;
      const savings = group ? computeSavings(group.ranked) : null;
      return {
        rawText: item.rawText,
        brandGuess: item.brandGuess,
        strengthGuess: item.strengthGuess,
        confidence: item.confidence,
        matched: group !== null,
        group,
        savings,
      };
    }),
  );

  const combinedAnnualSaving = items.reduce((sum, r) => sum + (r.savings?.annualSaving ?? 0), 0);

  return Response.json({ items, combinedAnnualSaving });
}
