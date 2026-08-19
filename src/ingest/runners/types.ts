export interface ExtractedProduct {
  sourceUrl: string;
  retailerSku: string;
  brandName: string | null;
  manufacturer: string | null;
  // Exactly as printed on the page, not cleaned up.
  rawCompositionText: string | null;
  packSize: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  inStock: boolean | null;
}

export interface DiscoveredUrl {
  url: string;
  title: string | null;
}

export interface RetailerRunner {
  retailerSlug: string;
  retailerName: string;
  baseUrl: string;
  productCollectorId: string;
  discoveryCollectorId: string;
  // True when one seed fetch (e.g. a search-results table) already returns
  // every row — expandSinglePhase is used instead of normalizeDiscovery +
  // normalizeProduct.
  singlePhase?: boolean;

  // Batch calls (many URLs in one Bright Data job) are unreliable against
  // some sites — extracted fields come back null under concurrent load even
  // though the same URL succeeds alone. Set to 1 to force one call per URL.
  // Defaults to chunks of 50 (discovery) / BATCH_SIZE (product).
  discoveryChunkSize?: number;
  productChunkSize?: number;

  discoveryUrls(): string[];

  // Unused when singlePhase.
  normalizeDiscovery(raw: unknown): DiscoveredUrl[];
  normalizeProduct(raw: unknown): ExtractedProduct;

  // Required when singlePhase.
  expandSinglePhase?(raw: unknown): ExtractedProduct[];

  // Fields this site actually exposes; a null here is a real extraction_issue.
  // Omit fields the site structurally never has. Defaults to all fields.
  expectedFields?: Array<keyof ExtractedProduct>;
}
