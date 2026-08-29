# Code review — file attachments (follow-up)

**Scope reviewed:** current uncommitted attachment feature diff on `codex/file-attachments`, re-reviewed after the implementation fixes.

**Checks performed:** `git diff --check` passed. I inspected the multipart parser, DB/object saga, quota locking, deletion queue, authenticated download route, generated OpenAPI, destination contract, plan/docs, and the added integration tests. The `remove-ai-slops` and `programming` skills are not present in the supplied skills catalog/roots, so their stated criteria were applied manually. The added tests are behavioral (not tautological or implementation-mirroring); the small storage interface remains justified by production S3 and test injection.

The claimed 73-file / 384-test Postgres-backed run could not be independently rerun in this reviewer environment because `TEST_DATABASE_URL` is unset. The new tests are correctly DB-gated (`apps/server/src/routes/submit.test.ts:26`, `apps/server/src/worker/retention.test.ts:24`, `apps/server/src/routes/v1/apiEndpoints.test.ts:28`); retain the stated run output with the release evidence.

## Prior findings — verified resolved

- **Multipart memory:** the maximum is now a conservative 16 MiB (`apps/server/src/routes/submit.ts:53-58`), and binary multipart bytes go directly to `parseMultipart`; `TextDecoder` is used only by the text-body branches (`apps/server/src/routes/submit.ts:302-339`). The new 15 MiB Team boundary test exercises the intended ceiling (`apps/server/src/routes/submit.test.ts:380-410`).
- **Capacity contract:** Team and self-host per-file limits are 15 MiB (`apps/server/src/lib/plan.ts:27-46`), while the submit reference explicitly distinguishes the independent 16 MiB aggregate request limit (`apps/site/src/content/docs/submit-endpoint.md:18-27`).
- **Race/retry coverage:** concurrent idempotent upload cleanup is tested (`apps/server/src/routes/submit.test.ts:259-306`), concurrent aggregate quota admission is tested (`333-378`), and failed deletion followed by retry is tested (`apps/server/src/worker/retention.test.ts:173-204`).
- **Download contract:** the operation explicitly declares 503 (`apps/server/src/routes/v1/submissions.ts:106-125`) and the unavailable-storage route behavior is tested (`apps/server/src/routes/v1/apiEndpoints.test.ts:160-172`).

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None. The webhook example now uses `field_name`, matching the delivered attachment contract (`docs/ARCHITECTURE.md:110`; `apps/server/src/destinations/types.ts:8-17`).

## Verdict

```json
{
  "codeQualityStatus": "CLEAR",
  "recommendation": "APPROVE",
  "blockers": []
}
```
