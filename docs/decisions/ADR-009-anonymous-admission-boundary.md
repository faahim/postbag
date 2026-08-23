# ADR-009 — Anonymous sandbox admission is a bounded durability boundary

**Status:** Accepted 2026-08-23

## Context

Postbag's normal Form contract stores rate-limit, quota, spam and schema outcomes
instead of dropping them. Anonymous sandbox Forms are different: they have no owner,
billing relationship or trusted identity, and a public actor can create unbounded
traffic unless admission itself has a hard edge.

ADR-008 admits anonymous sandbox Forms only when they are tightly bounded. We need
to state where the "never lose a Submission" promise begins without weakening that
promise for tenant-owned Forms.

## Decision

An anonymous request becomes an accepted Submission only when its row is committed
and the sandbox's accepted count is atomically reserved. Before that point it is an
admission attempt, not a Submission.

Admission rejects requests when the sandbox is expired, claimed or already contains
five accepted Submissions, or when the request exceeds the 16 KiB payload or depth-4
JSON limits. Creation is separately bounded by the feature kill switch, 20 sandboxes
per abuse-source key, a deployment-wide ceiling and edge rate limiting. Rejected
admission attempts do not create rows.

Every admitted anonymous Submission is durable until one of two explicit retention
events: its sandbox is claimed and the row is copied into the tenant-owned
`submissions` table, or the unclaimed sandbox expires and the retention job deletes
it. Claim and submit operations serialize in Postgres so a request cannot be both
lost and ambiguously owned.

The normal tenant-owned Form contract is unchanged: rate-limit, quota, spam and
schema outcomes are stored with a status after admission.

## Alternatives

- **Store unlimited anonymous overflow as quarantined.** This preserves one uniform
  write rule but gives an unauthenticated actor unbounded database storage. Rejected.
- **Count in application memory or at the edge.** This is fast but cannot make the
  five-Submission boundary correct across replicas or claim races. Rejected.
- **Describe anonymous rejection as lost Submissions.** This conflates requests that
  were never admitted with durable domain objects and makes the product contract
  impossible to state precisely. Rejected.

## Consequences

- Anonymous admission has a deliberately smaller contract than a claimed Form.
- The five-Submission cap and claim races require live Postgres concurrency tests.
- Edge controls reduce abuse volume, while Postgres remains the correctness boundary.
- Documentation must call rejected requests admission attempts, not dropped
  Submissions.
