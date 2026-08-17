// Pinned in .env and CLAUDE.md so collectors get reused, not recreated.
export const COLLECTOR_IDS = {
  pharmeasyProduct: process.env.PHARMEASY_PRODUCT_COLLECTOR ?? "",
  pharmeasyDiscovery: process.env.PHARMEASY_DISCOVERY_COLLECTOR ?? "",
  janaushadhi: process.env.JANAUSHADHI_COLLECTOR ?? "",
};
