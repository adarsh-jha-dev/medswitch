import { index, integer, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar, vector } from "drizzle-orm/pg-core";
import { molecule } from "./canonical";

// Not a boolean: the 2016 S.O. 814(E) tranche was quashed by the Delhi HC in 2019, appeal still pending.
export const bannedFdcStatus = ["prohibited", "unapproved", "revoked", "sub_judice"] as const;

export const bannedFdc = pgTable(
  "banned_fdc",
  {
    id: serial("id").primaryKey(),
    notificationRef: varchar("notification_ref", { length: 128 }).notNull(),
    notificationDate: timestamp("notification_date", { withTimezone: true }),
    rawText: text("raw_text").notNull(),
    // Joins against composition.molecule_set_hash.
    moleculeSetHash: varchar("molecule_set_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 16, enum: bannedFdcStatus }).notNull(),
    sourceUrl: text("source_url"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
    // rawText is short, one notification per row — embedded directly, no chunking.
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (table) => [index("banned_fdc_molecule_set_hash_idx").on(table.moleculeSetHash)],
);

// Null strength_mg means the notification bans the molecule set regardless of strength.
export const bannedFdcMolecule = pgTable(
  "banned_fdc_molecule",
  {
    id: serial("id").primaryKey(),
    bannedFdcId: integer("banned_fdc_id")
      .notNull()
      .references(() => bannedFdc.id, { onDelete: "cascade" }),
    moleculeId: integer("molecule_id")
      .notNull()
      .references(() => molecule.id, { onDelete: "restrict" }),
    strengthMg: numeric("strength_mg", { precision: 10, scale: 3 }),
  },
  (table) => [uniqueIndex("banned_fdc_molecule_unique_idx").on(table.bannedFdcId, table.moleculeId)],
);
