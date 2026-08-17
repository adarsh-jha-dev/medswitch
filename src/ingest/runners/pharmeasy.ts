import { COLLECTOR_IDS } from "../collector-ids";
import { dedupeRepeatedHalf, pickBoolean, pickNumber, pickString } from "../normalize";
import type { DiscoveredUrl, ExtractedProduct, RetailerRunner } from "./types";

// Collector creation/heal commands pinned in CLAUDE.md.
export const pharmeasyRunner: RetailerRunner = {
  retailerSlug: "pharmeasy",
  retailerName: "PharmEasy",
  baseUrl: "https://pharmeasy.in",
  productCollectorId: COLLECTOR_IDS.pharmeasyProduct,
  discoveryCollectorId: COLLECTOR_IDS.pharmeasyDiscovery,

  // Base + combination molecule pages for the 3 target categories — each
  // only lists ~5 branded medicines with no crawlable pagination, so combo
  // pages are what gets discovery volume up.
  discoveryUrls() {
    return [
      "https://pharmeasy.in/molecules/amlodipine-7868",
      "https://pharmeasy.in/molecules/telmisartan-7900",
      "https://pharmeasy.in/molecules/telmisartan-amlodipine-9302",
      "https://pharmeasy.in/molecules/amlodipine-olmesartan-medoxomil-985",
      "https://pharmeasy.in/molecules/hydrochlorothiazide-amlodipine-56",
      "https://pharmeasy.in/molecules/amlodipine-metoprolol-7775",
      "https://pharmeasy.in/molecules/amlodipine-atenolol-7849",
      "https://pharmeasy.in/molecules/telmisartan-hydrochlorothiazide-7808",
      "https://pharmeasy.in/molecules/telmisartan-atorvastatin-1070",
      "https://pharmeasy.in/molecules/telmisartan-metoprolol-9328",
      "https://pharmeasy.in/molecules/nebivolol-telmisartan-953",
      "https://pharmeasy.in/molecules/indapamide-telmisartan-177",
      "https://pharmeasy.in/molecules/cilnidipine-telmisartan-7338",
      "https://pharmeasy.in/molecules/metformin-7899",
      "https://pharmeasy.in/molecules/glimepiride-7851",
      "https://pharmeasy.in/molecules/metformin-glimepiride-9958",
      "https://pharmeasy.in/molecules/metformin-hydrochloride-492959",
      "https://pharmeasy.in/molecules/metformin-benfotiamine-2590",
      "https://pharmeasy.in/molecules/metformin-saxagliptin-1637",
      "https://pharmeasy.in/molecules/teneligliptin-metformin-hydrochloride-3065733",
      "https://pharmeasy.in/molecules/linagliptin-metformin-hydrochloride-3659657",
      "https://pharmeasy.in/molecules/vildagliptin-metformin-hydrochloride-3049376",
      "https://pharmeasy.in/molecules/glimepiride-metformin-hydrochloride-3051937",
      "https://pharmeasy.in/molecules/glimepiride-pioglitazone-135",
      "https://pharmeasy.in/molecules/paracetamol-acetaminophen-7802",
      "https://pharmeasy.in/molecules/diclofenac-6982",
      "https://pharmeasy.in/molecules/diclofenac-paracetamol-acetaminophen-3455006",
      "https://pharmeasy.in/molecules/tramadol-paracetamol-acetaminophen-3455278",
      "https://pharmeasy.in/molecules/aceclofenac-paracetamol-acetaminophen-3454953",
      "https://pharmeasy.in/molecules/ibuprofen-paracetamol-acetaminophen-3454908",
      "https://pharmeasy.in/molecules/nimesulide-paracetamol-acetaminophen-3455017",
      "https://pharmeasy.in/molecules/diclofenac-sodium-paracetamol-acetaminophen-3454969",
      "https://pharmeasy.in/molecules/diclofenac-potassium-paracetamol-acetaminophen-3454942",
      "https://pharmeasy.in/molecules/diclofenac-methocarbamol-2597",
      "https://pharmeasy.in/molecules/diclofenac-serratiopeptidase-7600",
      "https://pharmeasy.in/molecules/diclofenac-sodium-11170",
    ];
  },

  normalizeDiscovery(raw: unknown): DiscoveredUrl[] {
    const record = raw as Record<string, unknown>;
    const items = Array.isArray(record.branded_medicines)
      ? record.branded_medicines
      : Array.isArray(record.products)
        ? record.products
        : Array.isArray(record.medicines)
          ? record.medicines
          : Array.isArray(raw)
            ? raw
            : [raw];

    return (items as unknown[])
      .map((item) => ({
        url: pickString(item, ["url", "product_url", "link", "href"]),
        title: pickString(item, ["name", "product_name", "title"]),
      }))
      .filter((item): item is DiscoveredUrl => item.url !== null);
  },

  normalizeProduct(raw: unknown): ExtractedProduct {
    const sourceUrl = pickString(raw, ["url", "product_url", "source_url", "input.url"]) ?? "";
    return {
      sourceUrl,
      retailerSku: sourceUrl.split("/").filter(Boolean).pop() ?? sourceUrl,
      brandName: pickString(raw, ["brand_name", "product_name", "name", "title"]),
      manufacturer: pickString(raw, ["manufacturer", "manufacturer_or_marketer", "marketer", "made_by"]),
      rawCompositionText: dedupeRepeatedHalf(
        pickString(raw, ["salt_composition", "composition", "active_ingredients", "salt_content"]),
      ),
      packSize: pickString(raw, ["pack_size", "pack_size_label"]),
      mrp: pickNumber(raw, ["mrp", "maximum_retail_price"]),
      sellingPrice: pickNumber(raw, ["selling_price", "current_selling_price", "price"]),
      inStock: pickBoolean(
        raw,
        ["in_stock", "stock_status", "availability"],
        ["true", "in stock", "available"],
        ["false", "out of stock", "unavailable"],
      ),
    };
  },
};
