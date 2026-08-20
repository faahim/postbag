CREATE TABLE "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "organization" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "logo" text,
  "metadata" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  "active_organization_id" text,
  CONSTRAINT "session_token_unique" UNIQUE("token"),
  CONSTRAINT "session_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "session_active_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "organization"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" ("user_id");
--> statement-breakpoint
CREATE TABLE "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "account_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "account_provider_account_unique" UNIQUE("provider_id", "account_id")
);
--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" ("user_id");
--> statement-breakpoint
CREATE TABLE "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint
CREATE TABLE "member" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "member_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "member_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "member_organization_user_unique" UNIQUE("organization_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" ("organization_id");
--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" ("user_id");
--> statement-breakpoint
CREATE TABLE "invitation" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "email" text NOT NULL,
  "role" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "inviter_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "invitation_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "invitation_inviter_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" ("organization_id");
--> statement-breakpoint
CREATE TABLE "apikey" (
  "id" text PRIMARY KEY NOT NULL,
  "config_id" text DEFAULT 'postbag' NOT NULL,
  "name" text,
  "start" text,
  "prefix" text,
  "key" text NOT NULL,
  "organization_id" text NOT NULL,
  "refill_interval" integer,
  "refill_amount" integer,
  "last_refill_at" timestamptz,
  "enabled" boolean DEFAULT true NOT NULL,
  "rate_limit_enabled" boolean DEFAULT false NOT NULL,
  "rate_limit_time_window" integer,
  "rate_limit_max" integer,
  "request_count" integer DEFAULT 0 NOT NULL,
  "remaining" integer,
  "last_request" timestamptz,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "permissions" text,
  "metadata" text,
  CONSTRAINT "apikey_key_unique" UNIQUE("key"),
  CONSTRAINT "apikey_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "apikey_organization_id_idx" ON "apikey" ("organization_id");
--> statement-breakpoint
CREATE INDEX "apikey_config_id_idx" ON "apikey" ("config_id");
--> statement-breakpoint
CREATE TABLE "organization_settings" (
  "organization_id" text PRIMARY KEY NOT NULL,
  "plan" text DEFAULT 'free' NOT NULL,
  "timezone" text DEFAULT 'Europe/Stockholm' NOT NULL,
  "limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "organization_settings_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "organization_settings_organization_id_idx" ON "organization_settings" ("organization_id");
--> statement-breakpoint
CREATE TABLE "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "projects_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "projects_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "projects_organization_slug_unique" UNIQUE("organization_id", "slug")
);
--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" ("organization_id");
--> statement-breakpoint
CREATE TABLE "forms" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "project_id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "schema_mode" text DEFAULT 'observe' NOT NULL,
  "current_schema_version" integer,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "forms_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "forms_project_organization_fk" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "forms_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "forms_project_slug_unique" UNIQUE("organization_id", "project_id", "slug")
);
--> statement-breakpoint
CREATE INDEX "forms_organization_id_idx" ON "forms" ("organization_id");
--> statement-breakpoint
CREATE TABLE "form_schemas" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "form_id" text NOT NULL,
  "version" integer NOT NULL,
  "json_schema" jsonb NOT NULL,
  "ui" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "changelog" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "form_schemas_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "form_schemas_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL,
  CONSTRAINT "form_schemas_form_organization_fk" FOREIGN KEY ("form_id", "organization_id") REFERENCES "forms"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "form_schemas_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "form_schemas_form_version_unique" UNIQUE("form_id", "version"),
  CONSTRAINT "form_schemas_form_version_organization_unique" UNIQUE("form_id", "version", "organization_id")
);
--> statement-breakpoint
CREATE INDEX "form_schemas_organization_id_idx" ON "form_schemas" ("organization_id");
--> statement-breakpoint
CREATE TABLE "submissions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "form_id" text NOT NULL,
  "data" jsonb NOT NULL,
  "form_schema_version" integer,
  "status" text DEFAULT 'received' NOT NULL,
  "quarantine_reason" text,
  "spam" jsonb DEFAULT '{"score":0,"reasons":[]}'::jsonb NOT NULL,
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "idempotency_key" text,
  "test" boolean DEFAULT false NOT NULL,
  "received_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "submissions_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "submissions_form_organization_fk" FOREIGN KEY ("form_id", "organization_id") REFERENCES "forms"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "submissions_form_schema_organization_fk" FOREIGN KEY ("form_id", "form_schema_version", "organization_id") REFERENCES "form_schemas"("form_id", "version", "organization_id"),
  CONSTRAINT "submissions_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "submissions_form_idempotency_unique" UNIQUE("form_id", "idempotency_key")
);
--> statement-breakpoint
CREATE INDEX "submissions_organization_id_idx" ON "submissions" ("organization_id");
--> statement-breakpoint
CREATE INDEX "submissions_form_received_idx" ON "submissions" ("form_id", "received_at");
--> statement-breakpoint
CREATE TABLE "streams" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "current_schema_version" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "streams_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "streams_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "streams_organization_slug_unique" UNIQUE("organization_id", "slug")
);
--> statement-breakpoint
CREATE INDEX "streams_organization_id_idx" ON "streams" ("organization_id");
--> statement-breakpoint
CREATE TABLE "stream_schemas" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "stream_id" text NOT NULL,
  "version" integer NOT NULL,
  "json_schema" jsonb NOT NULL,
  "ui" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "changelog" text,
  "created_by" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "stream_schemas_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "stream_schemas_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL,
  CONSTRAINT "stream_schemas_stream_organization_fk" FOREIGN KEY ("stream_id", "organization_id") REFERENCES "streams"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "stream_schemas_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "stream_schemas_stream_version_unique" UNIQUE("stream_id", "version"),
  CONSTRAINT "stream_schemas_stream_version_organization_unique" UNIQUE("stream_id", "version", "organization_id")
);
--> statement-breakpoint
CREATE INDEX "stream_schemas_organization_id_idx" ON "stream_schemas" ("organization_id");
--> statement-breakpoint
CREATE TABLE "stream_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "stream_id" text NOT NULL,
  "form_id" text,
  "selector" text,
  "mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "mapping_status" text DEFAULT 'valid' NOT NULL,
  "missing" text[] DEFAULT '{}' NOT NULL,
  "stream_schema_version" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "stream_sources_exactly_one_source" CHECK (num_nonnulls("form_id", "selector") = 1),
  CONSTRAINT "stream_sources_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "stream_sources_stream_organization_fk" FOREIGN KEY ("stream_id", "organization_id") REFERENCES "streams"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "stream_sources_form_organization_fk" FOREIGN KEY ("form_id", "organization_id") REFERENCES "forms"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "stream_sources_schema_organization_fk" FOREIGN KEY ("stream_id", "stream_schema_version", "organization_id") REFERENCES "stream_schemas"("stream_id", "version", "organization_id"),
  CONSTRAINT "stream_sources_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "stream_sources_stream_form_unique" UNIQUE("stream_id", "form_id")
);
--> statement-breakpoint
CREATE INDEX "stream_sources_organization_id_idx" ON "stream_sources" ("organization_id");
--> statement-breakpoint
CREATE TABLE "destinations" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "health" text DEFAULT 'unknown' NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "consecutive_failures" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "destinations_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "destinations_id_organization_unique" UNIQUE("id", "organization_id")
);
--> statement-breakpoint
CREATE INDEX "destinations_organization_id_idx" ON "destinations" ("organization_id");
--> statement-breakpoint
CREATE TABLE "routes" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "form_id" text,
  "stream_id" text,
  "destination_id" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "mode" jsonb DEFAULT '{"type":"instant"}'::jsonb NOT NULL,
  "window" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "quality" jsonb DEFAULT '{"exclude_spam":true,"exclude_quarantined":true}'::jsonb NOT NULL,
  "filter" text,
  "transform" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "routes_exactly_one_source" CHECK (num_nonnulls("form_id", "stream_id") = 1),
  CONSTRAINT "routes_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "routes_form_organization_fk" FOREIGN KEY ("form_id", "organization_id") REFERENCES "forms"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "routes_stream_organization_fk" FOREIGN KEY ("stream_id", "organization_id") REFERENCES "streams"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "routes_destination_organization_fk" FOREIGN KEY ("destination_id", "organization_id") REFERENCES "destinations"("id", "organization_id") ON DELETE RESTRICT,
  CONSTRAINT "routes_id_organization_unique" UNIQUE("id", "organization_id")
);
--> statement-breakpoint
CREATE INDEX "routes_organization_id_idx" ON "routes" ("organization_id");
--> statement-breakpoint
CREATE TABLE "digests" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "route_id" text NOT NULL,
  "period_key" text NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "ready_at" timestamptz,
  "sent_at" timestamptz,
  CONSTRAINT "digests_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "digests_route_organization_fk" FOREIGN KEY ("route_id", "organization_id") REFERENCES "routes"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "digests_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "digests_route_period_unique" UNIQUE("route_id", "period_key")
);
--> statement-breakpoint
CREATE INDEX "digests_organization_id_idx" ON "digests" ("organization_id");
--> statement-breakpoint
CREATE TABLE "deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "submission_id" text NOT NULL,
  "route_id" text NOT NULL,
  "destination_id" text NOT NULL,
  "digest_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "skip_reason" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamptz DEFAULT now(),
  "last_error" text,
  "payload" jsonb NOT NULL,
  "schema_version" integer,
  "last_response" jsonb,
  "dedupe_key" text NOT NULL,
  "worker_id" text,
  "claimed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "sent_at" timestamptz,
  CONSTRAINT "deliveries_dedupe_key_unique" UNIQUE("dedupe_key"),
  CONSTRAINT "deliveries_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "deliveries_submission_organization_fk" FOREIGN KEY ("submission_id", "organization_id") REFERENCES "submissions"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "deliveries_route_organization_fk" FOREIGN KEY ("route_id", "organization_id") REFERENCES "routes"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "deliveries_destination_organization_fk" FOREIGN KEY ("destination_id", "organization_id") REFERENCES "destinations"("id", "organization_id") ON DELETE RESTRICT,
  CONSTRAINT "deliveries_digest_organization_fk" FOREIGN KEY ("digest_id", "organization_id") REFERENCES "digests"("id", "organization_id") ON DELETE RESTRICT,
  CONSTRAINT "deliveries_id_organization_unique" UNIQUE("id", "organization_id"),
  CONSTRAINT "deliveries_submission_route_unique" UNIQUE("submission_id", "route_id")
);
--> statement-breakpoint
CREATE INDEX "deliveries_organization_id_idx" ON "deliveries" ("organization_id");
--> statement-breakpoint
CREATE INDEX "deliveries_claim_idx" ON "deliveries" ("status", "next_attempt_at");
--> statement-breakpoint
CREATE TABLE "events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "type" text NOT NULL,
  "subject" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "events_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "events_id_organization_unique" UNIQUE("id", "organization_id")
);
--> statement-breakpoint
CREATE INDEX "events_organization_id_idx" ON "events" ("organization_id");
--> statement-breakpoint
CREATE INDEX "events_organization_created_idx" ON "events" ("organization_id", "created_at");
--> statement-breakpoint
CREATE TABLE "drift_events" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "form_id" text NOT NULL,
  "submission_id" text NOT NULL,
  "kind" text NOT NULL,
  "field" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "detected_at" timestamptz DEFAULT now() NOT NULL,
  "resolved_at" timestamptz,
  CONSTRAINT "drift_events_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "drift_events_form_organization_fk" FOREIGN KEY ("form_id", "organization_id") REFERENCES "forms"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "drift_events_submission_organization_fk" FOREIGN KEY ("submission_id", "organization_id") REFERENCES "submissions"("id", "organization_id") ON DELETE CASCADE,
  CONSTRAINT "drift_events_id_organization_unique" UNIQUE("id", "organization_id")
);
--> statement-breakpoint
CREATE INDEX "drift_events_organization_id_idx" ON "drift_events" ("organization_id");
--> statement-breakpoint
CREATE INDEX "drift_events_form_resolved_idx" ON "drift_events" ("form_id", "resolved_at");
--> statement-breakpoint
CREATE TABLE "system_webhooks" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "url" text NOT NULL,
  "events" text[] DEFAULT '{}' NOT NULL,
  "secret" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "health" text DEFAULT 'unknown' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "system_webhooks_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "system_webhooks_id_organization_unique" UNIQUE("id", "organization_id")
);
--> statement-breakpoint
CREATE INDEX "system_webhooks_organization_id_idx" ON "system_webhooks" ("organization_id");
--> statement-breakpoint
CREATE FUNCTION prevent_schema_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable; publish a new version', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER form_schemas_immutable BEFORE UPDATE ON form_schemas FOR EACH ROW EXECUTE FUNCTION prevent_schema_version_mutation();
--> statement-breakpoint
CREATE TRIGGER stream_schemas_immutable BEFORE UPDATE ON stream_schemas FOR EACH ROW EXECUTE FUNCTION prevent_schema_version_mutation();
