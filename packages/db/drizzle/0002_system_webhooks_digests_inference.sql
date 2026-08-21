CREATE TABLE "system_webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"webhook_id" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now(),
	"last_error" text,
	"last_response" jsonb,
	"dedupe_key" text NOT NULL,
	"worker_id" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "system_webhook_deliveries_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "form_schema_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"form_id" text NOT NULL,
	"json_schema" jsonb NOT NULL,
	"ui" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"inferred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "digest_period_key" text;--> statement-breakpoint
ALTER TABLE "system_webhooks" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "system_webhook_deliveries" ADD CONSTRAINT "system_webhook_deliveries_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_webhook_deliveries" ADD CONSTRAINT "system_webhook_deliveries_webhook_organization_fk" FOREIGN KEY ("webhook_id","organization_id") REFERENCES "public"."system_webhooks"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_webhook_deliveries" ADD CONSTRAINT "system_webhook_deliveries_event_organization_fk" FOREIGN KEY ("event_id","organization_id") REFERENCES "public"."events"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_schema_drafts" ADD CONSTRAINT "form_schema_drafts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_schema_drafts" ADD CONSTRAINT "form_schema_drafts_form_organization_fk" FOREIGN KEY ("form_id","organization_id") REFERENCES "public"."forms"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_webhook_deliveries_organization_id_idx" ON "system_webhook_deliveries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "system_webhook_deliveries_claim_idx" ON "system_webhook_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "system_webhook_deliveries_id_organization_unique" ON "system_webhook_deliveries" USING btree ("id","organization_id");--> statement-breakpoint
CREATE INDEX "form_schema_drafts_organization_id_idx" ON "form_schema_drafts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_schema_drafts_id_organization_unique" ON "form_schema_drafts" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_schema_drafts_form_unique" ON "form_schema_drafts" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "deliveries_digest_group_idx" ON "deliveries" USING btree ("route_id","digest_period_key");
--> statement-breakpoint
-- Job D §2 "the EventDispatcher seam": every `events` insert fans out to a
-- `system_webhook_deliveries` row for each of the org's enabled webhooks subscribed to
-- that event type. Implemented as a trigger (not a call site in application code) so no
-- future event-emitting code path can forget to dispatch — the database makes it correct.
CREATE FUNCTION dispatch_system_webhooks() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO system_webhook_deliveries
    (id, organization_id, webhook_id, event_id, event_type, payload, status, attempts, next_attempt_at, dedupe_key, created_at)
  SELECT
    'whd_' || replace(gen_random_uuid()::text, '-', ''),
    NEW.organization_id,
    sw.id,
    NEW.id,
    NEW.type,
    jsonb_build_object(
      'id', NEW.id,
      'type', NEW.type,
      'subject', NEW.subject,
      'data', NEW.data,
      'created_at', NEW.created_at
    ),
    'pending',
    0,
    now(),
    NEW.id || ':' || sw.id,
    now()
  FROM system_webhooks sw
  WHERE sw.organization_id = NEW.organization_id
    AND sw.enabled = true
    AND NEW.type = ANY(sw.events)
  ON CONFLICT (dedupe_key) DO NOTHING;
  PERFORM pg_notify('postbag_deliveries', '');
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER events_dispatch_system_webhooks AFTER INSERT ON events FOR EACH ROW EXECUTE FUNCTION dispatch_system_webhooks();