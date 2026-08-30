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

None remaining. The strict durable reservation and session-level lock remove the
previous outer-COMMIT accounting window: the reservation is committed before
`PutObject`, removed atomically with attachment metadata on acceptance, and retained
for cleanup/retry otherwise.

The previously discovered ambiguous-success `PutObject` hole is fixed:
`apps/server/src/routes/submit.ts:798-816` records each cleanup candidate before
awaiting storage, so an object committed before a transport failure is deleted or
durably queued. `apps/server/src/routes/submit.test.ts:229-250` exercises the
persist-then-throw case.

### MEDIUM

None. The session-level lock now keys on `attachments.length > 0`
(`apps/server/src/routes/submit.ts:805-808`), and the actual concurrent losing-replay
test uses a named zero-byte File (`apps/server/src/routes/submit.test.ts:388-435`).

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
- Final P1 review: attachment admission now takes the organization attachment lock
  and performs the exact capacity check before the first object write
  (`apps/server/src/routes/submit.ts:787-797`). It rechecks attachment idempotency
  under that same lock (`:799-805`), preventing a concurrent loser from uploading.
  Upload, the savepoint-backed Submission/outbox write, and either delete or durable
  cleanup-queue insertion all complete before the parent transaction returns
  (`:807-989`), so the lock covers the full capacity-sensitive saga.
- The new failure regression persists an object, forces deletion to fail, verifies
  the committed cleanup reservation, and proves a following upload is rejected at
  capacity (`apps/server/src/routes/submit.test.ts:277-326`). The concurrent
  idempotency and capacity tests now assert only one object is written
  (`:388-435`, `:462-507`). These are behavioral concurrency tests, not
  implementation-mirroring tests.
- Final P2 review: the early header replay is used only when response behavior is
  body-independent (`apps/server/src/routes/submit.ts:593-612`). HTML form replays
  parse the body and retain its `_redirect`; covered at
  `apps/server/src/routes/submit.test.ts:154-177`.
- I independently reran the DB-backed server suite after these changes: 32 files /
  201 tests passed. Server typecheck and `git diff --check` passed.
- Final reservation review: a dedicated session-level advisory lock spans the
  committed pre-upload `object_deletions` reservation, object storage I/O, accepted
  transaction reconciliation, and cleanup (`apps/server/src/routes/submit.ts:805-1074`).
  The reservation is deleted atomically with attachment metadata (`:909-931`) and
  retained or made immediately due if cleanup must retry (`:275-301`). This closes
  the prior ambiguous-commit capacity window without an untyped escape hatch or
  needless abstraction.
- I independently confirmed the zero-byte concurrent test content and reran the
  targeted server suite; the attachment paths passed. A separate local billing test
  currently fails unchanged from this diff (expected `pro`, received `free`), so it
  is recorded as an unrelated baseline/environment issue rather than attributed to
  the attachment changes. The supplied clean full-suite result should remain the
  release gate for this unrelated test.

## Skill-perspective check

The required `remove-ai-slops` and `programming` skills were not available in the
current skill catalog or local skill roots. Applied their stated criteria manually:
the new tests exercise failure/replay behavior rather than implementation constants;
production code adds no untyped escape hatch, unnecessary abstraction, or unrelated
parsing/normalization. No violation found.
