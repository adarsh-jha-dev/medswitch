CREATE TABLE "kendra" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"store_code" varchar(32) NOT NULL,
	"address" text NOT NULL,
	"pincode" varchar(10),
	"district" varchar(128),
	"state" varchar(128) NOT NULL,
	"contact_person" varchar(256),
	"contact_number" varchar(32),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "kendra_store_code_idx" ON "kendra" USING btree ("store_code");--> statement-breakpoint
CREATE INDEX "kendra_pincode_idx" ON "kendra" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "kendra_district_idx" ON "kendra" USING btree ("district");