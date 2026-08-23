CREATE TABLE "anonymous_sandboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"allowed_origin" text,
	"claim_email_hash" text,
	"token_hash" text NOT NULL,
	"token_replay_encrypted" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"creation_idempotency_key_hash" text NOT NULL,
	"request_body_hash" text NOT NULL,
	"abuse_source_key" text NOT NULL,
	"claimed_organization_id" text,
	"claimed_user_id" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anonymous_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key_hash" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anonymous_sandboxes" ADD CONSTRAINT "anonymous_sandboxes_claimed_organization_id_organization_id_fk" FOREIGN KEY ("claimed_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anonymous_sandboxes" ADD CONSTRAINT "anonymous_sandboxes_claimed_user_id_user_id_fk" FOREIGN KEY ("claimed_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anonymous_submissions" ADD CONSTRAINT "anonymous_submissions_sandbox_id_anonymous_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."anonymous_sandboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anonymous_sandboxes_creation_idempotency_unique" ON "anonymous_sandboxes" USING btree ("creation_idempotency_key_hash");--> statement-breakpoint
CREATE INDEX "anonymous_sandboxes_active_source_idx" ON "anonymous_sandboxes" USING btree ("abuse_source_key","status","expires_at");--> statement-breakpoint
CREATE INDEX "anonymous_sandboxes_expiry_idx" ON "anonymous_sandboxes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "anonymous_submissions_sandbox_received_idx" ON "anonymous_submissions" USING btree ("sandbox_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "anonymous_submissions_sandbox_idempotency_unique" ON "anonymous_submissions" USING btree ("sandbox_id","idempotency_key_hash");