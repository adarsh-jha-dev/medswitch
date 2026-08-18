import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

// A single active ingredient, e.g. "Metformin Hydrochloride".
export const molecule = pgTable(
  "molecule",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 256 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("molecule_normalized_name_idx").on(table.normalizedName)],
);

export const moleculeAlias = pgTable(
  "molecule_alias",
  {
    id: serial("id").primaryKey(),
    moleculeId: integer("molecule_id")
      .notNull()
      .references(() => molecule.id, { onDelete: "cascade" }),
    alias: varchar("alias", { length: 256 }).notNull(),
    normalizedAlias: varchar("normalized_alias", { length: 256 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("molecule_alias_normalized_idx").on(table.normalizedAlias)],
);

// A salt combination + strengths, e.g. "Metformin 500mg + Glimepiride 1mg".
// fingerprint_hash dedupes regardless of how a retailer formatted the raw string.
export const composition = pgTable(
  "composition",
  {
    id: serial("id").primaryKey(),
    fingerprintHash: varchar("fingerprint_hash", { length: 64 }).notNull(),
    normalizedText: text("normalized_text").notNull(),
    dosageForm: varchar("dosage_form", { length: 32 }).notNull(),
    releaseModifier: varchar("release_modifier", { length: 32 }),
    // pgvector embedding of the normalized composition text, for Day 3 fuzzy matching.
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("composition_fingerprint_hash_idx").on(table.fingerprintHash)],
);

export const compositionMolecule = pgTable(
  "composition_molecule",
  {
    id: serial("id").primaryKey(),
    compositionId: integer("composition_id")
      .notNull()
      .references(() => composition.id, { onDelete: "cascade" }),
    moleculeId: integer("molecule_id")
      .notNull()
      .references(() => molecule.id, { onDelete: "restrict" }),
    strengthValue: numeric("strength_value", { precision: 10, scale: 3 }),
    strengthUnit: varchar("strength_unit", { length: 16 }),
  },
  (table) => [
    uniqueIndex("composition_molecule_unique_idx").on(table.compositionId, table.moleculeId),
    index("composition_molecule_composition_id_idx").on(table.compositionId),
  ],
);

// Canonical, retailer-independent product. Unpopulated on Day 1 — listing.brand_product_id stays null until Day 2 matching.
export const brandProduct = pgTable(
  "brand_product",
  {
    id: serial("id").primaryKey(),
    canonicalName: varchar("canonical_name", { length: 256 }).notNull(),
    manufacturer: varchar("manufacturer", { length: 256 }),
    compositionId: integer("composition_id").references(() => composition.id, {
      onDelete: "set null",
    }),
    packSize: varchar("pack_size", { length: 128 }),
    packUnitCount: integer("pack_unit_count"),
    packUnitType: varchar("pack_unit_type", { length: 32 }),
    isGeneric: boolean("is_generic").default(false).notNull(),
    brandKey: varchar("brand_key", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("brand_product_composition_id_idx").on(table.compositionId),
    uniqueIndex("brand_product_brand_key_idx").on(table.brandKey),
  ],
);

export const compositionParseMethods = ["regex", "llm"] as const;

export const compositionParseCache = pgTable("composition_parse_cache", {
  id: serial("id").primaryKey(),
  rawHash: varchar("raw_hash", { length: 64 }).notNull(),
  rawText: text("raw_text").notNull(),
  parsed: jsonb("parsed"), // null = confirmed parse failure, cached so it isn't retried
  method: varchar("method", { length: 16, enum: compositionParseMethods }).notNull(),
  model: varchar("model", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("composition_parse_cache_raw_hash_idx").on(table.rawHash)]);
