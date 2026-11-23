CREATE TABLE "asset_candles" (
	"asset_id" uuid NOT NULL,
	"interval" varchar(8) NOT NULL,
	"bucket" timestamp with time zone NOT NULL,
	"open" numeric(30, 12) NOT NULL,
	"high" numeric(30, 12) NOT NULL,
	"low" numeric(30, 12) NOT NULL,
	"close" numeric(30, 12) NOT NULL,
	"volume" numeric(30, 12),
	CONSTRAINT "asset_candles_pk" PRIMARY KEY("asset_id","interval","bucket")
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) DEFAULT 'Watchlist' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"operator" "alert_operator" NOT NULL,
	"target_price" numeric(30, 12) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "candles_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_candles" ADD CONSTRAINT "asset_candles_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_items_watchlist_asset_unique" ON "watchlist_items" USING btree ("watchlist_id","asset_id");--> statement-breakpoint
CREATE INDEX "watchlist_items_watchlist_id_idx" ON "watchlist_items" USING btree ("watchlist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlists_user_id_unique" ON "watchlists" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "price_alerts_user_id_idx" ON "price_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "price_alerts_asset_active_idx" ON "price_alerts" USING btree ("asset_id","active");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");