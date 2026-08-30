ALTER TABLE "object_deletions" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "object_deletions" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
CREATE INDEX "object_deletions_organization_id_idx" ON "object_deletions" USING btree ("organization_id");--> statement-breakpoint
-- Keep pending objects in plan accounting until object storage confirms deletion.
-- Existing pre-0009 queue rows remain nullable because their deleted attachment metadata
-- can no longer be reconstructed; every new trigger/manual entry records both values.
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
