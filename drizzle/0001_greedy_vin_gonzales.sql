CREATE TABLE "composition_parse_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_hash" varchar(64) NOT NULL,
	"raw_text" text NOT NULL,
	"parsed" jsonb NOT NULL,
	"method" varchar(16) NOT NULL,
	"model" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "molecule_alias" (
	"id" serial PRIMARY KEY NOT NULL,
	"molecule_id" integer NOT NULL,
	"alias" varchar(256) NOT NULL,
	"normalized_alias" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_product" ADD COLUMN "pack_unit_count" integer;--> statement-breakpoint
ALTER TABLE "brand_product" ADD COLUMN "pack_unit_type" varchar(32);--> statement-breakpoint
ALTER TABLE "brand_product" ADD COLUMN "is_generic" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_product" ADD COLUMN "brand_key" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "composition" ADD COLUMN "dosage_form" varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE "composition" ADD COLUMN "release_modifier" varchar(32);--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "match_status" varchar(16) DEFAULT 'unmatched' NOT NULL;--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "match_confidence" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "molecule_alias" ADD CONSTRAINT "molecule_alias_molecule_id_molecule_id_fk" FOREIGN KEY ("molecule_id") REFERENCES "public"."molecule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "composition_parse_cache_raw_hash_idx" ON "composition_parse_cache" USING btree ("raw_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "molecule_alias_normalized_idx" ON "molecule_alias" USING btree ("normalized_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_product_brand_key_idx" ON "brand_product" USING btree ("brand_key");