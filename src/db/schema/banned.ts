import { index, integer, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { molecule } from "./canonical";

// Not a boolean: the March 2016 S.O. 814(E) tranche was quashed by the Delhi
// HC in Feb 2019 with CDSCO's appeal still pending, so "banned" can be
// legally false for a notification that still reads as banned elsewhere.
// Every row carries its notification so the UI states a fact
// ("prohibited under S.O. …, dated …"), not a bare badge.
export const bannedFdcStatus = ["prohibited", "unapproved", "revoked", "sub_judice"] as const;

export const bannedFdc = pgTable(
  "banned_fdc",
  {
    id: serial("id").primaryKey(),
    // The primary legal instrument, e.g. "S.O. 2847(E)" or "G.S.R. 503(E)" —
    // always carried through so a flag is traceable to source, not just to
    // whatever consolidated list it was scraped from.
    notificationRef: varchar("notification_ref", { length: 128 }).notNull(),
    notificationDate: timestamp("notification_date", { withTimezone: true }),
    rawText: text("raw_text").notNull(),
    // sha256 of sorted molecule ids only — joins against composition.molecule_set_hash.
    moleculeSetHash: varchar("molecule_set_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 16, enum: bannedFdcStatus }).notNull(),
    sourceUrl: text("source_url"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("banned_fdc_molecule_set_hash_idx").on(table.moleculeSetHash)],
);

// Per-molecule strength as stated in the notification, when it states one.
// Null strength_mg means the notification banned the molecule *set*
// irrespective of strength — a molecule_set_hash match is already a
// candidate; matching strengths here is what promotes it to confirmed.
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
