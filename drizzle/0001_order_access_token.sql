ALTER TABLE "orders" ADD COLUMN "access_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_access_token_unique" UNIQUE("access_token");