import { COLLECTOR_IDS } from "../collector-ids";
import { dedupeRepeatedHalf, pickBoolean, pickNumber, pickString } from "../normalize";
import type { DiscoveredUrl, ExtractedProduct, RetailerRunner } from "./types";

// Same 6 seed molecules as PharmEasy/Jan Aushadhi, not new ones — breadth of
// retailers per composition matters more than breadth of compositions. URL
// scheme: apollopharmacy.in/salt/<slug>, either lowercase-hyphenated or
// UPPERCASE+plus-joined (both resolve).
export const apolloRunner: RetailerRunner = {
  retailerSlug: "apollo",
  retailerName: "Apollo Pharmacy",
  baseUrl: "https://www.apollopharmacy.in",
  productCollectorId: COLLECTOR_IDS.apolloProduct,
  discoveryCollectorId: COLLECTOR_IDS.apolloDiscovery,
  // Batched calls return fields as null under concurrent load; single-URL calls are reliable, if slower.
  discoveryChunkSize: 1,
  productChunkSize: 1,

  discoveryUrls() {
    return [
      "https://www.apollopharmacy.in/salt/amlodipine",
      "https://www.apollopharmacy.in/salt/telmisartan",
      "https://www.apollopharmacy.in/salt/AMLODIPINE+TELMISARTAN",
      "https://www.apollopharmacy.in/salt/TELMISARTAN+AMLODIPINE+CHLORTHALIDONE",
      "https://www.apollopharmacy.in/salt/S%20AMLODIPINE+TELMISARTAN",
      "https://www.apollopharmacy.in/salt/Metoprolol%20Tartrate+amlodipine+telmisartan",
      "https://www.apollopharmacy.in/salt/metformin",
      "https://www.apollopharmacy.in/salt/glimepiride",
      "https://www.apollopharmacy.in/salt/glimepiride-metformin",
      "https://www.apollopharmacy.in/salt/paracetamol",
      "https://www.apollopharmacy.in/salt/diclofenac",
      "https://www.apollopharmacy.in/salt/aceclofenac-paracetamol",
      "https://www.apollopharmacy.in/salt/aceclofenac-paracetamol-serratiopeptidase",
      "https://www.apollopharmacy.in/salt/ACECLOFENAC+PARACETAMOL+TOLPERISONE",
    ];
  },

  normalizeDiscovery(raw: unknown): DiscoveredUrl[] {
    const record = raw as Record<string, unknown>;
    const items = Array.isArray(record.medicines)
      ? record.medicines
      : Array.isArray(record.products)
        ? record.products
        : Array.isArray(raw)
          ? raw
          : [raw];

    return (items as unknown[])
      .map((item) => ({
        url: pickString(item, ["product_url", "url", "link", "href"]),
        title: pickString(item, ["product_name", "name", "title"]),
      }))
      .filter((item): item is DiscoveredUrl => item.url !== null);
  },

  normalizeProduct(raw: unknown): ExtractedProduct {
    const sourceUrl = pickString(raw, ["url", "product_url", "source_url", "input.url"]) ?? "";
    return {
      sourceUrl,
      retailerSku: sourceUrl.split("/").filter(Boolean).pop() ?? sourceUrl,
      brandName: pickString(raw, ["product_name", "name", "title"]),
      manufacturer: pickString(raw, ["manufacturer", "marketed_by", "manufacturer_name", "made_by"]),
      rawCompositionText: dedupeRepeatedHalf(
        pickString(raw, ["composition", "salt_composition", "active_ingredients", "salt_content"]),
      ),
      packSize: pickString(raw, ["pack_size", "pack_size_label", "quantity"]),
      mrp: pickNumber(raw, ["mrp", "maximum_retail_price", "original_price"]),
      sellingPrice: pickNumber(raw, ["selling_price", "current_selling_price", "price", "discounted_price"]),
      inStock: pickBoolean(
        raw,
        ["in_stock", "availability_status", "stock_status", "availability"],
        ["true", "in stock", "available"],
        ["false", "out of stock", "unavailable"],
      ),
    };
  },
};
