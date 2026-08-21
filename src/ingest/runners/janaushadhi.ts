import { COLLECTOR_IDS } from "../collector-ids";
import { pickNumber, pickString } from "../normalize";
import type { DiscoveredUrl, ExtractedProduct, RetailerRunner } from "./types";

// Real data source is the legacy pmbi.co.in/ProductList.aspx search page, not
// janaushadhi.gov.in (a JS-only SPA with no server-rendered data) — see
// docs/targets.md. One search returns every matching row directly, so
// discovery IS the product data (singlePhase).
export const janaushadhiRunner: RetailerRunner = {
  retailerSlug: "janaushadhi",
  retailerName: "Jan Aushadhi",
  baseUrl: "https://www.pmbi.co.in",
  productCollectorId: COLLECTOR_IDS.janaushadhi,
  discoveryCollectorId: COLLECTOR_IDS.janaushadhi,
  singlePhase: true,
  // No manufacturer or stock column exists on this page (nationwide MRP cap
  // list, not live retailer inventory).
  expectedFields: ["brandName", "rawCompositionText", "packSize", "mrp", "sellingPrice"],

  discoveryUrls() {
    return [
      "https://www.pmbi.co.in/ProductList.aspx?search=Amlodipine",
      "https://www.pmbi.co.in/ProductList.aspx?search=Telmisartan",
      "https://www.pmbi.co.in/ProductList.aspx?search=Metformin",
      "https://www.pmbi.co.in/ProductList.aspx?search=Glimepiride",
      "https://www.pmbi.co.in/ProductList.aspx?search=Paracetamol",
      "https://www.pmbi.co.in/ProductList.aspx?search=Diclofenac",
    ];
  },

  normalizeDiscovery(): DiscoveredUrl[] {
    return [];
  },
  normalizeProduct(): ExtractedProduct {
    throw new Error("janaushadhi is singlePhase — use expandSinglePhase");
  },

  expandSinglePhase(raw: unknown): ExtractedProduct[] {
    const record = raw as Record<string, unknown>;
    const rows = Array.isArray(record.rows)
      ? record.rows
      : Array.isArray(record.results)
        ? record.results
        : Array.isArray(raw)
          ? raw
          : [raw];

    return (rows as unknown[])
      .map((row): ExtractedProduct | null => {
        const drugCode = pickString(row, ["drug_code", "code"]);
        const genericName = pickString(row, ["generic_name", "name", "product_name"]);
        if (!drugCode || !genericName) return null;
        return {
          sourceUrl: `https://www.pmbi.co.in/ProductList.aspx#drug-${drugCode}`,
          retailerSku: drugCode,
          brandName: genericName,
          manufacturer: null,
          rawCompositionText: genericName,
          packSize: pickString(row, ["unit_size", "pack_size"]),
          mrp: pickNumber(row, ["mrp", "mrp_in_rs"]),
          sellingPrice: pickNumber(row, ["mrp", "mrp_in_rs"]),
          inStock: null,
        };
      })
      .filter((p): p is ExtractedProduct => p !== null);
  },
};
