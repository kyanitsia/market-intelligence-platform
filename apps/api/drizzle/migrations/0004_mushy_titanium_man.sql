CREATE TABLE "asset_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"currency" "currency" NOT NULL,
	"price" numeric(30, 12) NOT NULL,
	"as_of" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_prices" ADD CONSTRAINT "asset_prices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_prices_asset_currency_unique" ON "asset_prices" USING btree ("asset_id","currency");--> statement-breakpoint
CREATE INDEX "asset_prices_asset_id_idx" ON "asset_prices" USING btree ("asset_id");