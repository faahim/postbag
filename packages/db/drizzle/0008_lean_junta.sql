CREATE TABLE "object_deletions" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"form_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"field_name" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_attachments" ADD CONSTRAINT "submission_attachments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attachments" ADD CONSTRAINT "submission_attachments_form_organization_fk" FOREIGN KEY ("form_id","organization_id") REFERENCES "public"."forms"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attachments" ADD CONSTRAINT "submission_attachments_submission_organization_fk" FOREIGN KEY ("submission_id","organization_id") REFERENCES "public"."submissions"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "object_deletions_pending_idx" ON "object_deletions" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "submission_attachments_submission_idx" ON "submission_attachments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_attachments_organization_id_idx" ON "submission_attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_attachments_id_organization_unique" ON "submission_attachments" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_attachments_storage_key_unique" ON "submission_attachments" USING btree ("storage_key");--> statement-breakpoint
-- Objects are intentionally cleaned up out-of-band. This trigger is part of the
-- deletion transaction, so a cascade never silently leaves an untracked object behind.
CREATE FUNCTION enqueue_submission_attachment_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO object_deletions (storage_key)
  VALUES (OLD.storage_key)
  ON CONFLICT (storage_key) DO NOTHING;
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER submission_attachments_enqueue_object_deletion
AFTER DELETE ON submission_attachments
FOR EACH ROW
EXECUTE FUNCTION enqueue_submission_attachment_deletion();--> statement-breakpoint
-- The trigger runs as its invoking role. The RLS-restricted app role therefore needs
-- queue access even though the operational table has no tenant row or policy.
GRANT SELECT, INSERT, UPDATE, DELETE ON object_deletions TO postbag_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON submission_attachments TO postbag_app;--> statement-breakpoint
ALTER TABLE submission_attachments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON submission_attachments
  USING (organization_id = current_setting('app.org_id', true))
  WITH CHECK (organization_id = current_setting('app.org_id', true));
