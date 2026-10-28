CREATE TYPE "public"."crm_task_status" AS ENUM('PENDIENTE', 'COMPLETADA', 'OMITIDA');--> statement-breakpoint
CREATE TYPE "public"."crm_task_type" AS ENUM('D5_CHECKIN', 'D12_SURVEY');--> statement-breakpoint
CREATE TYPE "public"."delivery_fee_status" AS ENUM('NO_APLICA', 'CALCULADO', 'A_CONFIRMAR');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('DELIVERY', 'RETIRO');--> statement-breakpoint
CREATE TYPE "public"."order_change_kind" AS ENUM('ESTADO', 'EDICION', 'PAGO');--> statement-breakpoint
CREATE TYPE "public"."order_item_type" AS ENUM('PACK', 'BURRITO_PACK', 'COMPLEMENTO');--> statement-breakpoint
CREATE TYPE "public"."order_origin" AS ENUM('WEB', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PRELIMINAR', 'PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'EN_PRODUCCION', 'LISTO', 'ENTREGADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('EFECTIVO', 'TRANSFERENCIA', 'PENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDIENTE', 'PAGADO');--> statement-breakpoint
CREATE TYPE "public"."portion_size" AS ENUM('MUY_CHICA', 'ADECUADA', 'MUY_GRANDE');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('ESENCIAL', 'PROTEICO', 'BURRITO', 'COMPLEMENTO');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'COCINA');--> statement-breakpoint
CREATE SEQUENCE "public"."order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 101 CACHE 1;--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"type" "crm_task_type" NOT NULL,
	"scheduled_for" date NOT NULL,
	"status" "crm_task_status" DEFAULT 'PENDIENTE' NOT NULL,
	"result_notes" text,
	"operator_id" uuid,
	"completed_at" timestamp with time zone,
	CONSTRAINT "crm_tasks_order_type" UNIQUE("order_id","type")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" varchar(255),
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"consent_commercial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "delivery_days_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "order_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"changed_by" uuid,
	"kind" "order_change_kind" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"note" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"recipe_version" varchar(32) NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_item_details_quantity_positive" CHECK ("order_item_details"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"item_type" "order_item_type" NOT NULL,
	"tier_size" integer,
	"category" "product_category" NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	CONSTRAINT "order_items_pack_has_size" CHECK ("order_items"."item_type" = 'COMPLEMENTO' OR "order_items"."tier_size" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(16) DEFAULT 'PAS-' || lpad(nextval('order_number_seq')::text, 6, '0') NOT NULL,
	"origin" "order_origin" DEFAULT 'WEB' NOT NULL,
	"customer_id" uuid,
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"customer_email" varchar(255),
	"delivery_type" "delivery_type" NOT NULL,
	"delivery_address" jsonb,
	"delivery_distance_m" integer,
	"delivery_fee_status" "delivery_fee_status" DEFAULT 'NO_APLICA' NOT NULL,
	"scheduled_date" date NOT NULL,
	"scheduled_time_slot" varchar(64) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"delivery_fee" numeric(10, 2),
	"total" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'PRELIMINAR' NOT NULL,
	"payment_method" "payment_method" DEFAULT 'PENDIENTE' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDIENTE' NOT NULL,
	"cancellation_reason" text,
	"survey_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_survey_token_unique" UNIQUE("survey_token"),
	CONSTRAINT "orders_cancelled_has_reason" CHECK ("orders"."status" <> 'CANCELADO' OR "orders"."cancellation_reason" IS NOT NULL),
	CONSTRAINT "orders_pickup_has_no_fee_status" CHECK ("orders"."delivery_type" <> 'RETIRO' OR "orders"."delivery_fee_status" = 'NO_APLICA'),
	CONSTRAINT "orders_amounts_non_negative" CHECK ("orders"."subtotal" >= 0 AND "orders"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pack_pricing_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "product_category" NOT NULL,
	"size" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	CONSTRAINT "pack_pricing_tiers_category_size" UNIQUE("category","size"),
	CONSTRAINT "pack_pricing_tiers_is_pack" CHECK ("pack_pricing_tiers"."category" <> 'COMPLEMENTO'),
	CONSTRAINT "pack_pricing_tiers_size_positive" CHECK ("pack_pricing_tiers"."size" > 0),
	CONSTRAINT "pack_pricing_tiers_price_non_negative" CHECK ("pack_pricing_tiers"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"recipe_version" varchar(32) NOT NULL,
	"rating_overall" integer,
	"rating_flavor" integer,
	"rating_texture" integer,
	"portion_size" "portion_size",
	"comments" text,
	"not_tested_yet" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_reviews_order_product" UNIQUE("order_id","product_id"),
	CONSTRAINT "product_reviews_ratings_range" CHECK (("product_reviews"."rating_overall" IS NULL OR "product_reviews"."rating_overall" BETWEEN 1 AND 5)
        AND ("product_reviews"."rating_flavor" IS NULL OR "product_reviews"."rating_flavor" BETWEEN 1 AND 5)
        AND ("product_reviews"."rating_texture" IS NULL OR "product_reviews"."rating_texture" BETWEEN 1 AND 5)),
	CONSTRAINT "product_reviews_not_tested_has_no_ratings" CHECK (NOT "product_reviews"."not_tested_yet" OR ("product_reviews"."rating_overall" IS NULL AND "product_reviews"."rating_flavor" IS NULL
        AND "product_reviews"."rating_texture" IS NULL AND "product_reviews"."portion_size" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "product_category" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"ingredients" text DEFAULT '' NOT NULL,
	"allergens" text DEFAULT '' NOT NULL,
	"net_weight_g" integer,
	"macros" jsonb,
	"image_url" varchar(1024),
	"price" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"recipe_version" varchar(32) DEFAULT 'v1.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_complement_has_price" CHECK ("products"."category" <> 'COMPLEMENTO' OR "products"."price" IS NOT NULL),
	CONSTRAINT "products_price_non_negative" CHECK ("products"."price" IS NULL OR "products"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"up_to_m" integer NOT NULL,
	"fee" numeric(10, 2) NOT NULL,
	CONSTRAINT "shipping_tiers_up_to_m_unique" UNIQUE("up_to_m"),
	CONSTRAINT "shipping_tiers_distance_positive" CHECK ("shipping_tiers"."up_to_m" > 0),
	CONSTRAINT "shipping_tiers_fee_non_negative" CHECK ("shipping_tiers"."fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_changes" ADD CONSTRAINT "order_changes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_changes" ADD CONSTRAINT "order_changes_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_details" ADD CONSTRAINT "order_item_details_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_details" ADD CONSTRAINT "order_item_details_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_tasks_due_idx" ON "crm_tasks" USING btree ("scheduled_for","status");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "order_changes_order_idx" ON "order_changes" USING btree ("order_id","changed_at");--> statement-breakpoint
CREATE INDEX "order_item_details_item_idx" ON "order_item_details" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "order_item_details_product_idx" ON "order_item_details" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_scheduled_date_idx" ON "orders" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_customer_email_idx" ON "orders" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "product_reviews_product_idx" ON "product_reviews" USING btree ("product_id","recipe_version");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");