# ADR-002 — The Postgres outbox is the delivery queue

**Status:** Accepted 2026-08-21

## Context
A submission must never be lost, delivery must retry, and multiple workers must not
double-send. The lead pipeline proved this pattern on SQLite; Postgres makes it
simpler.

## Decision
`deliveries` is both the record and the queue. Rows are created in the same
transaction as the submission. Workers claim with
`SELECT … FOR UPDATE SKIP LOCKED`, process, and update status. `LISTEN/NOTIFY`
wakes idle workers; a 15 s tick guarantees progress without it. Uniqueness on
`(submission_id, route_id)` makes routing idempotent under crashes and retries.

## Alternatives
- **Redis + BullMQ / SQS / Cloudflare Queues.** Adds a second stateful service the
  self-host must run, and a dual-write problem between "the row" and "the job".
- **Send from the request handler.** Fast, and loses data on any provider hiccup.
- **pg-boss / Graphile Worker.** Reasonable; rejected for now because the outbox
  *is* domain data with its own lifecycle and UI, not a generic job. May adopt
  Graphile Worker later for housekeeping jobs only.

## Consequences
- One Postgres is a single point of truth and of load. Measure before adding anything.
- Worker code is ours: backoff, dead-lettering, alerting. Keep it small and tested.
