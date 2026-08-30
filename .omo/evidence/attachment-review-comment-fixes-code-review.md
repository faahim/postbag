# Code review — attachment PR feedback fixes

**Reviewed branch:** `codex/attachment-review-fixes` (worktree state reviewed 2026-08-30)

**Scope:** the three GitHub PR #11 findings: queued-object retained-byte accounting,
header-based idempotent multipart replays, and explicit organization fences. This
update also reviews the two subsequent P2 changes: migration safety for legacy queue
rows and a single-statement usage snapshot. It also covers the related ambiguous
`PutObject` cleanup path fixed during this review.

## Result

- `codeQualityStatus`: **CLEAR**
- `recommendation`: **APPROVE**
- `blockers`: None.

## Findings

### CRITICAL

None.

### HIGH

None remaining.

The previously discovered ambiguous-success `PutObject` hole is fixed:
`apps/server/src/routes/submit.ts:798-816` records each cleanup candidate before
awaiting storage, so an object committed before a transport failure is deleted or
durably queued. `apps/server/src/routes/submit.test.ts:229-250` exercises the
persist-then-throw case.

### MEDIUM

None.

### LOW

None.

## Verification and assessment

- The P1 quota fix is correct and migration-safe. Migration
  `packages/db/drizzle/0009_chief_angel.sql:1-14` fails before any mutation when a
  legacy queue row exists, then adds required `organization_id` and `size_bytes`
  columns. The trigger and failed-upload cleanup rows both supply those values;
  retained usage sums live metadata and queued work. See
  `apps/server/src/routes/submit.ts:275-294` and
  `apps/server/src/lib/planUsage.ts:49-69`.
- Retained usage now obtains both sums in a single SQL statement
  (`apps/server/src/lib/planUsage.ts:53-67`), giving PostgreSQL's statement-level
  snapshot rather than two independently timed reads. The query is limited to the
  requested organization in both subqueries.
- Queue accounting is behaviorally covered on both explicit deletion and retention
  deletion, including release only after the object-deletion sweep:
  `apps/server/src/routes/submit.test.ts:450-488` and
  `apps/server/src/worker/retention.test.ts:149-174`.
- The P2 replay lookup occurs before current plan limits, multipart parsing, and
  storage availability checks (`apps/server/src/routes/submit.ts:593-610`). The
  regression test downgrades the file limit and removes storage yet gets the
  original receipt (`apps/server/src/routes/submit.test.ts:258-281`).
- The tenant fence is centralized, reused for early replay and concurrent-loser
  recovery, and constrains both submission and attachment lookups:
  `apps/server/src/routes/submit.ts:349-384`. Other attachment consumers already
  carry matching organization predicates; authenticated cross-tenant download is
  covered in `apps/server/src/routes/v1/apiEndpoints.test.ts:174-178`.
- Fresh PostgreSQL 16 migration proof supplied with this review established that
  migration 0009 rejects a seeded legacy row with its actionable hint, succeeds
  after the queue is drained, and creates both metadata columns as NOT NULL.
- I independently reran the focused DB-backed submission and retention suite:
  32 files / 199 tests passed. Workspace typecheck and `git diff --check` passed.
  The wider fresh-PG migration proof and the previously completed DB/RLS suite
  remain valid supporting evidence.
- Production preflight succeeded: a read-only in-container query established that
  `object_deletions` is empty before the new migration. This satisfies the
  migration's explicit upgrade precondition.

## Skill-perspective check

The required `remove-ai-slops` and `programming` skills were not available in the
current skill catalog or local skill roots. Applied their stated criteria manually:
the new tests exercise failure/replay behavior rather than implementation constants;
production code adds no untyped escape hatch, unnecessary abstraction, or unrelated
parsing/normalization. No violation found.
