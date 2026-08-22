CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_inviter_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "billing_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "billing_subscription_id" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "billing_subscription_status" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "billing_current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "billing_cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "billing_provider_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_provider_event_id_unique" ON "billing_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "billing_events_pending_idx" ON "billing_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "billing_events_organization_id_idx" ON "billing_events" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_events TO postbag_app;--> statement-breakpoint
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON billing_events
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
