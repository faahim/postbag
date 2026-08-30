---
title: "Security: keys, scopes, tenancy, signatures, spam"
description: "Postbag's security model: API keys hashed at rest with manage/read/submit scopes, organization scoping on every row with row-level security as a second fence, private attachment storage, HMAC-SHA256 webhook signatures, honeypot, rate limits, origin allowlists and Turnstile."
order: 31
section: Operate
---

## Authentication and keys

Dashboard sessions use cookies (Better Auth). Everything else uses `Authorization: Bearer pb_live_…`. Keys are organization-scoped, shown once, stored as SHA-256 hashes with a visible prefix, and carry scopes: `manage` ⊇ `read` ⊇ `submit`. Revoke under API keys or `DELETE /v1/api-keys/{id}`.

## Tenancy

Every tenant-owned row has a non-null `organization_id`; repositories require an organization scope, so a cross-tenant query cannot be expressed. Postgres row-level security policies and a `postbag_app` role ship in the migrations as a second fence.

## Outbound signatures

Webhook and system-webhook deliveries carry `Postbag-Signature: t=…,v1=…` (HMAC-SHA256 over `{t}.{body}`) when a secret is configured. Verify over the raw body in constant time and reject stale timestamps. Secrets are never echoed back by the API.

## Attachments

Attachments are private objects in S3-compatible storage; display filename, content
type, byte size, checksum and Submission reference are tenant-scoped metadata. Object
keys are opaque and never returned. The dashboard and authenticated API authorize the
Organization before issuing a short-lived download URL. Email, Telegram and webhooks
receive short-lived signed links, not binary files.

Multipart requests have a 16 MiB total ceiling and each plan separately bounds file
size, attachment count and retained storage. File names and declared content types are
display metadata, not a trust decision. A Submission's retention or explicit deletion
also enqueues its object for durable deletion retry. Anonymous sandboxes are file-free.
Queued objects continue counting toward retained storage until deletion succeeds.
The first release has no previews, malware scanning, resumable uploads or
client-direct storage uploads.

## Inbound protection

Honeypot, per-form per-IP rate limit with burst, origin allowlist (also the CORS policy), optional Cloudflare Turnstile, a 256 KB JSON/urlencoded ceiling and a 16 MiB multipart ceiling. Outcomes after admission are stored with a status; nothing is silently dropped and bots receive the same response as humans. Attachment capacity is an admission boundary: a request that cannot fit in durable retained capacity is rejected before it becomes a Submission.

## Data

Submissions are deleted only by explicit user action or the plan's retention period. Test submissions are excluded from quotas. Structured logs carry ids, not payloads.

## Reporting

Found something? Use the contact form on the [about page](/about/#contact). We prefer coordinated disclosure and respond quickly.
