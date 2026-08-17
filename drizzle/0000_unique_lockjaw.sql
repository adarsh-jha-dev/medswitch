CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "brand_product" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_name" varchar(256) NOT NULL,
	"manufacturer" varchar(256),
	"composition_id" integer,
	"pack_size" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "composition" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint_hash" varchar(64) NOT NULL,
	"normalized_text" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "composition_molecule" (
	"id" serial PRIMARY KEY NOT NULL,
	"composition_id" integer NOT NULL,
	"molecule_id" integer NOT NULL,
	"strength_value" numeric(10, 3),
	"strength_unit" varchar(16)
);
--> statement-breakpoint
CREATE TABLE "molecule" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"normalized_name" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing" (
	"id" serial PRIMARY KEY NOT NULL,
	"retailer_id" integer NOT NULL,
	"retailer_sku" varchar(256) NOT NULL,
	"product_url" text NOT NULL,
	"brand_product_id" integer,
	"raw_title" text,
	"raw_composition_text" text,
	"raw_manufacturer" text,
	"raw_pack_size" text,
	"pincode" varchar(10) NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_point" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"collector_run_id" integer,
	"mrp" numeric(10, 2),
	"sale_price" numeric(10, 2),
	"in_stock" boolean,
	"pincode" varchar(10) NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_document" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"collector_run_id" integer,
	"body" "bytea" NOT NULL,
	"blob_key" varchar(512),
	"content_hash" varchar(64) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retailer" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"base_url" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collector_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"retailer_id" integer NOT NULL,
	"collector_id" varchar(128) NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"rows_expected" integer DEFAULT 0 NOT NULL,
	"rows_returned" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "extraction_issue" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"collector_run_id" integer NOT NULL,
	"field_name" varchar(64) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_product" ADD CONSTRAINT "brand_product_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_molecule" ADD CONSTRAINT "composition_molecule_composition_id_composition_id_fk" FOREIGN KEY ("composition_id") REFERENCES "public"."composition"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composition_molecule" ADD CONSTRAINT "composition_molecule_molecule_id_molecule_id_fk" FOREIGN KEY ("molecule_id") REFERENCES "public"."molecule"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_retailer_id_retailer_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_brand_product_id_brand_product_id_fk" FOREIGN KEY ("brand_product_id") REFERENCES "public"."brand_product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_point" ADD CONSTRAINT "price_point_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_point" ADD CONSTRAINT "price_point_collector_run_id_collector_run_id_fk" FOREIGN KEY ("collector_run_id") REFERENCES "public"."collector_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_document" ADD CONSTRAINT "raw_document_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_document" ADD CONSTRAINT "raw_document_collector_run_id_collector_run_id_fk" FOREIGN KEY ("collector_run_id") REFERENCES "public"."collector_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collector_run" ADD CONSTRAINT "collector_run_retailer_id_retailer_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_issue" ADD CONSTRAINT "extraction_issue_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_issue" ADD CONSTRAINT "extraction_issue_collector_run_id_collector_run_id_fk" FOREIGN KEY ("collector_run_id") REFERENCES "public"."collector_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_product_composition_id_idx" ON "brand_product" USING btree ("composition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "composition_fingerprint_hash_idx" ON "composition" USING btree ("fingerprint_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "composition_molecule_unique_idx" ON "composition_molecule" USING btree ("composition_id","molecule_id");--> statement-breakpoint
CREATE INDEX "composition_molecule_composition_id_idx" ON "composition_molecule" USING btree ("composition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "molecule_normalized_name_idx" ON "molecule" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_retailer_sku_idx" ON "listing" USING btree ("retailer_id","retailer_sku");--> statement-breakpoint
CREATE INDEX "listing_brand_product_id_idx" ON "listing" USING btree ("brand_product_id");--> statement-breakpoint
CREATE INDEX "price_point_listing_id_captured_at_idx" ON "price_point" USING btree ("listing_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "raw_document_listing_id_idx" ON "raw_document" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_slug_idx" ON "retailer" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "collector_run_retailer_id_idx" ON "collector_run" USING btree ("retailer_id");--> statement-breakpoint
CREATE INDEX "extraction_issue_field_name_idx" ON "extraction_issue" USING btree ("field_name");