import {
  boolean,
  customType,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { brandProduct } from "./canonical";
import { collectorRun } from "./ops";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const matchStatuses = ["unmatched", "auto", "review", "verified", "rejected"] as const;

export const retailer = pgTable(
  "retailer",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    baseUrl: varchar("base_url", { length: 512 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("retailer_slug_idx").on(table.slug)],
);

export const listing = pgTable(
  "listing",
  {
    id: serial("id").primaryKey(),
    retailerId: integer("retailer_id")
      .notNull()
      .references(() => retailer.id, { onDelete: "cascade" }),
    retailerSku: varchar("retailer_sku", { length: 256 }).notNull(),
    productUrl: text("product_url").notNull(),
    brandProductId: integer("brand_product_id").references(() => brandProduct.id, {
      onDelete: "set null",
    }),
    rawTitle: text("raw_title"),
    rawCompositionText: text("raw_composition_text"),
    rawManufacturer: text("raw_manufacturer"),
    rawPackSize: text("raw_pack_size"),
    matchStatus: varchar("match_status", { length: 16, enum: matchStatuses })
      .notNull()
      .default("unmatched"),
    matchConfidence: numeric("match_confidence", { precision: 4, scale: 3 }),
    pincode: varchar("pincode", { length: 10 }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("listing_retailer_sku_idx").on(table.retailerId, table.retailerSku),
    index("listing_brand_product_id_idx").on(table.brandProductId),
  ],
);

// Only written when (sale_price, in_stock) differs from the listing's latest row.
export const pricePoint = pgTable(
  "price_point",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    collectorRunId: integer("collector_run_id").references(() => collectorRun.id, {
      onDelete: "set null",
    }),
    mrp: numeric("mrp", { precision: 10, scale: 2 }),
    salePrice: numeric("sale_price", { precision: 10, scale: 2 }),
    inStock: boolean("in_stock"),
    pincode: varchar("pincode", { length: 10 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("price_point_listing_id_captured_at_idx").on(table.listingId, table.capturedAt.desc())],
);

// Gzipped raw collector output, so fields can be re-parsed without re-scraping.
export const rawDocument = pgTable(
  "raw_document",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    collectorRunId: integer("collector_run_id").references(() => collectorRun.id, {
      onDelete: "set null",
    }),
    body: bytea("body").notNull(),
    blobKey: varchar("blob_key", { length: 512 }),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("raw_document_listing_id_idx").on(table.listingId)],
);
