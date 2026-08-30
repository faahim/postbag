# Code review — attachment PR feedback fixes

**Reviewed branch:** `codex/attachment-review-fixes` (worktree state reviewed 2026-08-30)

**Scope:** the three GitHub PR #11 findings: queued-object retained-byte accounting,
header-based idempotent multipart replays, and explicit organization fences. Also
reviewed the related ambiguous `PutObject` cleanup path fixed during this review.

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

- The P1 quota fix is correct: deletion-trigger queue rows and failed-upload
  cleanup rows carry `organization_id` and `size_bytes`; retained usage sums both
  live metadata and queued work. See `packages/db/drizzle/0009_quick_zuras.sql:7-17`,
  `apps/server/src/routes/submit.ts:275-294`, and
  `apps/server/src/lib/planUsage.ts:47-61`.
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
- Local upgrade state had migration 0009 applied with the new function definition
  and an empty legacy queue. Integration suite result: 32 files / 199 tests passed;
  database integration/RLS result: 2 files / 12 tests passed; lint and typecheck
  passed. `git diff --check` passed.
- Production preflight also succeeded: a read-only in-container query established
  that `object_deletions` contains zero pre-0009 rows. The nullable legacy-row
  migration edge case therefore cannot affect the deployed accounting guarantee.

## Skill-perspective check

The required `remove-ai-slops` and `programming` skills were not available in the
current skill catalog or local skill roots. Applied their stated criteria manually:
the new tests exercise failure/replay behavior rather than implementation constants;
production code adds no untyped escape hatch, unnecessary abstraction, or unrelated
parsing/normalization. No violation found.
