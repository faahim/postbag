CREATE TABLE "worker_heartbeats" (
  "worker_id" text PRIMARY KEY NOT NULL,
  "heartbeat_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
  "organization_id" text NOT NULL,
  "key" text NOT NULL,
  "method" text NOT NULL,
  "path" text NOT NULL,
  "status_code" integer NOT NULL,
  "response_body" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL,
  CONSTRAINT "idempotency_keys_organization_id_key_pk" PRIMARY KEY ("organization_id", "key"),
  CONSTRAINT "idempotency_keys_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" ("expires_at");
