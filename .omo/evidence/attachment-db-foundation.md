# Attachment database foundation evidence

Recorded: 2026-08-30

## Migration and cleanup queue

- Scenario: apply every migration, including `0008_lean_junta.sql`, to a brand-new
  isolated PostgreSQL 16 container.
- Invocation: `DATABASE_URL=postgres://postbag:postbag@localhost:55433/postbag pnpm db:migrate`
- Binary observable: Drizzle reported `migrations applied successfully`.

- Scenario: an RLS-restricted `postbag_app` request deletes a Submission with one
  attachment and the database trigger persists cleanup work after the attachment row
  cascades.
- Invocation: transaction seeded one organization/form/submission/attachment, then
  executed `SET LOCAL ROLE postbag_app`, set `app.org_id`, deleted the Submission, and
  selected `object_deletions`.
- Binary observable: `DELETE 1` followed by
  `private/org_attachment_evidence/fl_attachment_evidence:0` before rollback. This
  proves the restricted role could execute the trigger and insert/read its durable
  retry record.

## Type and plan checks

- Scenario: compile the changed core and database packages.
- Invocation: `pnpm --filter @postbag/core build && pnpm --filter @postbag/db build`
- Binary observable: both TypeScript builds exited zero.

- Scenario: run the server's plan test suite after adding plan defaults and override
  handling for attachments.
- Invocation: `pnpm --filter @postbag/server test -- src/lib/plan.test.ts`
- Binary observable: Vitest reported `12 passed | 20 skipped` files and `45 passed |
  138 skipped` tests, exit zero.
