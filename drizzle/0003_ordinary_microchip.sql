CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "banned_fdc" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_ref" varchar(128) NOT NULL,
	"notification_date" timestamp with time zone,
	"raw_text" text NOT NULL,
	"molecule_set_hash" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"source_url" text,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banned_fdc_molecule" (
	"id" serial PRIMARY KEY NOT NULL,
	"banned_fdc_id" integer NOT NULL,
	"molecule_id" integer NOT NULL,
	"strength_mg" numeric(10, 3)
);
--> statement-breakpoint
CREATE TABLE "molecule_merge_suggestion" (
	"id" serial PRIMARY KEY NOT NULL,
	"molecule_a_id" integer NOT NULL,
	"molecule_b_id" integer NOT NULL,
	"similarity" numeric(4, 3) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "heal_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"retailer_id" integer,
	"collector_id" varchar(128) NOT NULL,
	"field_name" varchar(64),
	"symptom" text NOT NULL,
	"heal_prompt" text NOT NULL,
	"rows_before" integer,
	"rows_after" integer,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"healed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "safety_chunk" (
	"id" serial PRIMARY KEY NOT NULL,
	"composition_id" integer NOT NULL,
	"section" varchar(32) NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"source_url" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
ALTER TABLE "composition" ADD COLUMN "molecule_set_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "banned_fdc_molecule" ADD CONSTRAINT "banned_fdc_molecule_banned_fdc_id_banned_fdc_id_fk" FOREIGN KEY ("banned_fdc_id") REFERENCES "public"."banned_fdc"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banned_fdc_molecule" ADD CONSTRAINT "banned_fdc_molecule_molecule_id_molecule_id_fk" FOREIGN KEY ("molecule_id") REFERENCES "public"."molecule"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "molecule_merge_suggestion" ADD CONSTRAINT "molecule_merge_suggestion_molecule_a_id_molecule_id_fk" FOREIGN KEY ("molecule_a_id") REFERENCES "public"."molecule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "molecule_merge_suggestion" ADD CONSTRAINT "molecule_merge_suggestion_molecule_b_id_molecule_id_fk" FOREIGN KEY ("molecule_b_id") REFERENCES "public"."molecule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heal_event" ADD CONSTRAINT "heal_event_retailer_id_retailer_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_chunk" ADD CONSTRAINT "safety_chunk_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banned_fdc_molecule_set_hash_idx" ON "banned_fdc" USING btree ("molecule_set_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "banned_fdc_molecule_unique_idx" ON "banned_fdc_molecule" USING btree ("banned_fdc_id","molecule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "molecule_merge_suggestion_pair_idx" ON "molecule_merge_suggestion" USING btree ("molecule_a_id","molecule_b_id");--> statement-breakpoint
CREATE INDEX "heal_event_collector_id_idx" ON "heal_event" USING btree ("collector_id");--> statement-breakpoint
CREATE INDEX "safety_chunk_composition_id_idx" ON "safety_chunk" USING btree ("composition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "safety_chunk_composition_section_chunk_idx" ON "safety_chunk" USING btree ("composition_id","section","chunk_index");--> statement-breakpoint
CREATE INDEX "composition_molecule_set_hash_idx" ON "composition" USING btree ("molecule_set_hash");--> statement-breakpoint
CREATE INDEX "molecule_normalized_name_trgm_idx" ON "molecule" USING gin ("normalized_name" gin_trgm_ops);