import type OpenAI from "openai";
import { z } from "zod";
import { bannedMatchesByCompositionId, searchBannedNotifications } from "../queries/banned";
import { resolveSubstitutionGroup, getSubstitutionGroup } from "../queries/substitution";

// Three constrained functions, not SQL access: the agent physically cannot
// cross a composition boundary (different strength/salt/dosage form) or
// invent a price, because these are the only ways it can touch the DB.

export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "find_substitutes",
      description:
        "Return ranked cross-retailer price listings for one exact composition — same molecules, same " +
        "strengths, same dosage form. Identify the composition EITHER by a short brand or molecule name " +
        "(e.g. 'Telma AM', 'Metformin' — this does a substring search, so pass a short name, not a full " +
        "composition description) OR, if you already have a compositionFingerprint (from a prior tool result " +
        "or from the conversation's scoped context), pass that instead for an exact lookup. Never returns a " +
        "different strength, salt, or dosage form. Every listing carries sourceUrl and capturedAt — always " +
        "cite both when stating a price.",
      parameters: {
        type: "object",
        properties: {
          brandOrMolecule: {
            type: "string",
            description: "A short brand name or a molecule/generic name to look up (not a full composition string).",
          },
          compositionFingerprint: {
            type: "string",
            description: "An exact composition fingerprint already known from context, if you have one.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_banned",
      description:
        "Check whether a composition (identified by the compositionFingerprint returned from find_substitutes) " +
        "matches a CDSCO banned fixed-dose combination (FDC) notification. Returns tier 'confirmed' (molecule set " +
        "AND every stated strength match exactly), 'candidate' (same molecule set, strengths differ or the " +
        "notification never stated strengths), or 'none' (no match at all). NEVER describe a 'candidate' result " +
        "as banned or prohibited — only 'confirmed' results carry that status.",
      parameters: {
        type: "object",
        properties: {
          compositionFingerprint: {
            type: "string",
            description: "The compositionFingerprint field from a prior find_substitutes result.",
          },
        },
        required: ["compositionFingerprint"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_notifications",
      description:
        "Semantic search over the text of the 156 CDSCO gazette notifications banning fixed-dose combinations " +
        "(August 2024 tranche). Use this for questions about WHY a combination is regulated, or to find " +
        "notifications about a topic in natural language. This is legal/regulatory text, not clinical or safety " +
        "information — do not use it to answer dosage, side-effect, or interaction questions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "A natural-language description of what to search for." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

const findSubstitutesSchema = z
  .object({
    brandOrMolecule: z.string().min(1).optional(),
    compositionFingerprint: z.string().min(1).optional(),
  })
  .refine((v) => v.brandOrMolecule || v.compositionFingerprint, {
    message: "Provide either brandOrMolecule or compositionFingerprint.",
  });
const checkBannedSchema = z.object({ compositionFingerprint: z.string().min(1) });
const searchNotificationsSchema = z.object({ query: z.string().min(1) });

export async function executeTool(name: string, rawArgs: unknown): Promise<unknown> {
  switch (name) {
    case "find_substitutes": {
      const parsed = findSubstitutesSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return { found: false, message: "Provide either brandOrMolecule or compositionFingerprint." };
      }
      const { brandOrMolecule, compositionFingerprint } = parsed.data;
      const group = compositionFingerprint
        ? await getSubstitutionGroup(compositionFingerprint)
        : await resolveSubstitutionGroup(brandOrMolecule!);
      if (!group) {
        const query = compositionFingerprint ?? brandOrMolecule;
        return { found: false, message: `No composition found matching "${query}". Do not guess — say so.` };
      }

      const retailerCount = new Set(group.ranked.map((r) => r.retailer)).size;

      return {
        found: true,
        compositionFingerprint: group.fingerprintHash,
        composition: group.normalizedText,
        dosageForm: group.dosageForm,
        releaseModifier: group.releaseModifier,
        molecules: group.molecules,
        retailerCount,
        listings: group.ranked.map((r) => ({
          retailer: r.retailer,
          brand: r.brandName,
          isGeneric: r.isGeneric,
          packSize: r.packSize,
          price: r.salePrice,
          perUnit: r.perUnit,
          sourceUrl: r.productUrl,
          capturedAt: r.capturedAt,
          matchStatus: r.matchStatus,
        })),
        note:
          retailerCount < 2
            ? "Only one retailer currently has a priced listing for this exact composition — say this plainly rather than implying a comparison exists."
            : null,
      };
    }

    case "check_banned": {
      const { compositionFingerprint } = checkBannedSchema.parse(rawArgs);
      const group = await getSubstitutionGroup(compositionFingerprint);
      if (!group) return { tier: "none" };

      const matches = await bannedMatchesByCompositionId(group.compositionId);
      if (matches.length === 0) return { tier: "none" };

      const confirmed = matches.find((m) => m.tier === "confirmed");
      const best = confirmed ?? matches[0];
      return {
        tier: best.tier,
        notificationRef: best.notificationRef,
        notificationDate: best.notificationDate,
        status: best.status,
        sourceUrl: best.sourceUrl,
        rawText: best.rawText,
      };
    }

    case "search_notifications": {
      const { query } = searchNotificationsSchema.parse(rawArgs);
      const results = await searchBannedNotifications(query);
      return { results };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
