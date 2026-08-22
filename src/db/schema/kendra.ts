import { index, integer, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// A PMBJP Jan Aushadhi Kendra (retail generic-medicine store), sourced
// directly from janaushadhi.gov.in's own public getAllKendraByStateDistrict
// API — not a Bright Data collector, since the endpoint is a plain
// unauthenticated-beyond-a-guest-token JSON API with no anti-bot posture and
// no JS rendering to work around. See scripts/kendra-ingest.ts.
export const kendra = pgTable(
  "kendra",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").notNull(),
    storeCode: varchar("store_code", { length: 32 }).notNull(),
    address: text("address").notNull(),
    pincode: varchar("pincode", { length: 10 }),
    district: varchar("district", { length: 128 }),
    state: varchar("state", { length: 128 }).notNull(),
    contactPerson: varchar("contact_person", { length: 256 }),
    contactNumber: varchar("contact_number", { length: 32 }),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("kendra_store_code_idx").on(table.storeCode),
    index("kendra_pincode_idx").on(table.pincode),
    index("kendra_district_idx").on(table.district),
  ],
);
