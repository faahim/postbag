# ADR-010 — Private S3-compatible attachment storage with a durable admission boundary

**Status:** Accepted 2026-08-30; implementation in progress

## Context

Postbag receives Submissions first and routes them later. Screenshots and other
attachments must preserve that property without turning the database into an object
store, exposing customer files publicly, or making hosted plans a feature gate.

Object bytes need a real retained-capacity limit. Unlike a monthly submission limit,
an attachment that does not fit cannot be committed honestly as a complete durable
receipt. The boundary must be explicit so Principle 4 remains meaningful.

## Decision

1. Attachments are a multipart property of a Submission. Their fields in `data` hold
   `fl_…` references; tenant-scoped metadata holds the field, display filename,
   declared type, byte size, checksum and opaque private object key.
2. Objects live in private S3-compatible storage. Hosted Postbag uses its configured
   private storage; self-hosts configure a compatible provider and limits. Dashboard
   and authenticated API reads authorize the Organization and issue short-lived
   signed download URLs. Objects are not public.
3. Receipt uses a small saga: validate and bound the multipart request, write opaque
   objects, then commit the Submission, metadata, Delivery rows and event in one
   database transaction. If commit or idempotency resolution loses after objects
   were written, the objects are deleted or placed on a durable deletion-retry queue.
4. Delivery adapters receive short-lived signed links, not binary objects: email and
   Telegram render links and webhook payloads include `attachments[]`.
5. Attachment storage is a capacity admission boundary. Free permits 2 MiB per
   attachment, 3 per Submission and 100 MiB retained; Pro 10 MiB, 10 and 10 GiB;
   Team 15 MiB, 20 and 100 GiB. Every multipart request also has a 16 MiB aggregate
   body ceiling, so the per-file and count values are independent maxima. The API locks
   and checks aggregate retained bytes at
   commit. A self-host configures equivalent limits.
6. A request that exceeds size, count or retained capacity is rejected before a
   complete durable receipt exists; it is not a lost Submission. Once the
   transaction commits, normal no-drop, delivery and retention rules apply.
7. Attachment metadata is deleted with its Submission. A durable queue retries
   object deletion until it succeeds. Anonymous sandboxes remain file-free.
8. The first release does not add previews, malware scanning, resumable upload or
   client-direct upload. Those need separate threat models and ADRs if proposed.

## Alternatives

- **Put object bytes in Postgres.** One durability system, but it bloats the primary
  database, backups and replication for a workload S3-compatible storage is built
  for. Rejected.
- **Give browsers a public or direct object-store upload path.** This complicates
  admission, idempotency and ownership, and risks orphaned or unvalidated objects.
  Rejected for the first release.
- **Soft-fail retained-storage quota after accepting the object.** This would permit
  unbounded retained bytes and make the stated capacity false. Rejected.
- **Make attachments a paid-only feature.** It violates ADR-006: plans differ by
  capacity, not product access. Rejected.

## Consequences

- The Submit, Submission, Delivery, dashboard, API, SDK, CLI and MCP surfaces all
  expose the same attachment references and authorized download path.
- Object storage credentials remain deployment configuration, never data submitted
  by a Form or exposed in a response.
- Tests must cover multipart boundaries, idempotency cleanup, tenant isolation,
  signed-link delivery, deletion retries and aggregate-capacity races before hosted
  release is called complete.
