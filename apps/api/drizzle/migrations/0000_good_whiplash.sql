CREATE TYPE "public"."alert_operator" AS ENUM('GTE', 'LTE');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('CRYPTO', 'STOCK', 'ETF');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."portfolio_share_mode" AS ENUM('FULL', 'ALLOCATION_ONLY', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."portfolio_visibility" AS ENUM('PRIVATE', 'PUBLIC', 'FOLLOWERS_ONLY');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255),
	"display_name" varchar(120),
	"avatar_url" varchar(2048),
	"default_currency" "currency" DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"external_provider" varchar(50) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"status" "asset_status" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"quantity" numeric(30, 12) NOT NULL,
	"avg_cost_basis" numeric(30, 12) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"total_value" numeric(30, 12) NOT NULL,
	"peak_value" numeric(30, 12) NOT NULL,
	"captured_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"visibility" "portfolio_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"share_mode" "portfolio_share_mode" DEFAULT 'HIDDEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"quantity" numeric(30, 12) NOT NULL,
	"price" numeric(30, 12) NOT NULL,
	"realized_pnl" numeric(30, 12),
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_symbol_type_unique" ON "assets" USING btree ("symbol","asset_type");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_provider_external_id_unique" ON "assets" USING btree ("external_provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_portfolio_asset_unique" ON "holdings" USING btree ("portfolio_id","asset_id");--> statement-breakpoint
CREATE INDEX "holdings_portfolio_id_idx" ON "holdings" USING btree ("portfolio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_snapshots_portfolio_date_unique" ON "portfolio_snapshots" USING btree ("portfolio_id","captured_on");--> statement-breakpoint
CREATE INDEX "portfolio_snapshots_portfolio_date_idx" ON "portfolio_snapshots" USING btree ("portfolio_id","captured_on");--> statement-breakpoint
CREATE INDEX "portfolios_user_id_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "portfolios_user_deleted_idx" ON "portfolios" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "transactions_portfolio_occurred_idx" ON "transactions" USING btree ("portfolio_id","occurred_at");--> statement-breakpoint
CREATE INDEX "transactions_portfolio_asset_idx" ON "transactions" USING btree ("portfolio_id","asset_id");