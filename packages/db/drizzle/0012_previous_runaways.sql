DROP INDEX "object_deletions_upload_idempotency_idx";--> statement-breakpoint
-- The preceding branch revision placed the same hash on every attachment in an
-- active multi-file reservation. Preserve one deterministic leader before enforcing
-- the database uniqueness invariant so upgrades cannot fail mid-upload.
WITH ranked AS (
  SELECT
    storage_key,
    row_number() OVER (
      PARTITION BY organization_id, upload_idempotency_hash
      ORDER BY created_at, storage_key
    ) AS position
  FROM object_deletions
  WHERE upload_idempotency_hash IS NOT NULL
)
UPDATE object_deletions
SET upload_idempotency_hash = NULL
FROM ranked
WHERE object_deletions.storage_key = ranked.storage_key
  AND ranked.position > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "object_deletions_upload_idempotency_unique" ON "object_deletions" USING btree ("organization_id","upload_idempotency_hash");
