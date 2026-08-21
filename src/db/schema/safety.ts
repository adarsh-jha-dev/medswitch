import { index, integer, pgTable, serial, text, timestamp, uniqueIndex, varchar, vector } from "drizzle-orm/pg-core";
import { composition } from "./canonical";

export const safetyChunkSections = ["uses", "side_effects", "warnings", "storage"] as const;

// One canonical safety text per composition, not per listing.
export const safetyChunk = pgTable(
  "safety_chunk",
  {
    id: serial("id").primaryKey(),
    compositionId: integer("composition_id")
      .notNull()
      .references(() => composition.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 32, enum: safetyChunkSections }).notNull(),
    chunkIndex: integer("chunk_index").notNull().default(0),
    text: text("text").notNull(),
    sourceUrl: text("source_url"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (table) => [
    index("safety_chunk_composition_id_idx").on(table.compositionId),
    uniqueIndex("safety_chunk_composition_section_chunk_idx").on(
      table.compositionId,
      table.section,
      table.chunkIndex,
    ),
  ],
);
