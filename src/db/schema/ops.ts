import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { listing, retailer } from "./marketplace";

export const collectorRunStatus = ["running", "succeeded", "failed", "partial"] as const;

export const collectorRun = pgTable(
  "collector_run",
  {
    id: serial("id").primaryKey(),
    retailerId: integer("retailer_id")
      .notNull()
      .references(() => retailer.id, { onDelete: "cascade" }),
    collectorId: varchar("collector_id", { length: 128 }).notNull(),
    status: varchar("status", { length: 16, enum: collectorRunStatus }).notNull().default("running"),
    rowsExpected: integer("rows_expected").notNull().default(0),
    rowsReturned: integer("rows_returned").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("collector_run_retailer_id_idx").on(table.retailerId)],
);

// A field that came back null/empty from an otherwise-successful extraction.
export const extractionIssue = pgTable(
  "extraction_issue",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    collectorRunId: integer("collector_run_id")
      .notNull()
      .references(() => collectorRun.id, { onDelete: "cascade" }),
    fieldName: varchar("field_name", { length: 64 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("extraction_issue_field_name_idx").on(table.fieldName)],
);

// A `scraper heal` call against a Bright Data collector: what broke, what was
// sent to fix it, and the before/after row counts as evidence it worked.
export const healEvent = pgTable(
  "heal_event",
  {
    id: serial("id").primaryKey(),
    retailerId: integer("retailer_id").references(() => retailer.id, { onDelete: "cascade" }),
    collectorId: varchar("collector_id", { length: 128 }).notNull(),
    fieldName: varchar("field_name", { length: 64 }), // null = whole-collector heal
    symptom: text("symptom").notNull(),
    healPrompt: text("heal_prompt").notNull(),
    rowsBefore: integer("rows_before"),
    rowsAfter: integer("rows_after"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    healedAt: timestamp("healed_at", { withTimezone: true }),
  },
  (table) => [index("heal_event_collector_id_idx").on(table.collectorId)],
);
