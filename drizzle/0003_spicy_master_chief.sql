CREATE TABLE "customer_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_sub" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "customer_accounts_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_account_id_customer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_sessions_account_idx" ON "customer_sessions" USING btree ("account_id");