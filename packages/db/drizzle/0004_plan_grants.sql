-- Job K — plan_source on organizations, complimentary access via grant codes.
-- `plan_grants` is deliberately NOT a tenant row (no organization_id, no RLS policy):
-- it is minted by a platform admin (PLATFORM_ADMIN_EMAILS) before any tenant is
-- involved, the same reason migration 0003 leaves better-auth's own tables uncovered.
-- `plan_grant_redemptions` records which org redeemed which grant and IS tenant data
-- (carries organization_id), so it joins the RLS second fence below like every other
-- org-scoped table added since 0003.
CREATE TABLE "plan_grant_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"plan" text NOT NULL,
	"note" text,
	"plan_duration_days" integer,
	"expires_at" timestamp with time zone,
	"max_redemptions" integer DEFAULT 1 NOT NULL,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "plan_grants_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "plan_source" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "plan_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "plan_note" text;--> statement-breakpoint
ALTER TABLE "plan_grant_redemptions" ADD CONSTRAINT "plan_grant_redemptions_grant_id_plan_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."plan_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grant_redemptions" ADD CONSTRAINT "plan_grant_redemptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_grant_redemptions_grant_id_idx" ON "plan_grant_redemptions" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "plan_grant_redemptions_organization_id_idx" ON "plan_grant_redemptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "plan_grants_created_by_user_id_idx" ON "plan_grants" USING btree ("created_by_user_id");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_grant_redemptions TO postbag_app;
--> statement-breakpoint
ALTER TABLE plan_grant_redemptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON plan_grant_redemptions
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));