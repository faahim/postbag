-- Legacy queue rows have no organization or size metadata to backfill. Refuse the
-- upgrade until the old worker has drained them instead of silently undercounting.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM object_deletions) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot migrate while attachment object deletions are pending.',
      HINT = 'Keep the current worker running until object_deletions is empty, then retry the migration.';
  END IF;
END;
$$;--> statement-breakpoint
ALTER TABLE "object_deletions" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "object_deletions" ADD COLUMN "size_bytes" integer NOT NULL;--> statement-breakpoint
CREATE INDEX "object_deletions_organization_id_idx" ON "object_deletions" USING btree ("organization_id");--> statement-breakpoint
-- Keep pending objects in plan accounting until object storage confirms deletion.
CREATE OR REPLACE FUNCTION enqueue_submission_attachment_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO object_deletions (storage_key, organization_id, size_bytes)
  VALUES (OLD.storage_key, OLD.organization_id, OLD.size_bytes)
  ON CONFLICT (storage_key) DO NOTHING;
  RETURN OLD;
END;
$$;
