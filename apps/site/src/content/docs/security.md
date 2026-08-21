---
title: "Security: keys, scopes, tenancy, signatures, spam"
description: "Postbag's security model: API keys hashed at rest with manage/read/submit scopes, organization scoping on every row with row-level security as a second fence, HMAC-SHA256 webhook signatures, honeypot, rate limits, origin allowlists and Turnstile, and a no-drop data policy."
order: 31
section: Operate
---

## Authentication and keys

Dashboard sessions use cookies (Better Auth). Everything else uses `Authorization: Bearer pb_live_…`. Keys are organization-scoped, shown once, stored as SHA-256 hashes with a visible prefix, and carry scopes: `manage` ⊇ `read` ⊇ `submit`. Revoke under API keys or `DELETE /v1/api-keys/{id}`.

## Tenancy

Every tenant-owned row has a non-null `organization_id`; repositories require an organization scope, so a cross-tenant query cannot be expressed. Postgres row-level security policies and a `postbag_app` role ship in the migrations as a second fence.

## Outbound signatures

Webhook and system-webhook deliveries carry `Postbag-Signature: t=…,v1=…` (HMAC-SHA256 over `{t}.{body}`) when a secret is configured. Verify over the raw body in constant time and reject stale timestamps. Secrets are never echoed back by the API.

## Inbound protection

Honeypot, per-form per-IP rate limit with burst, origin allowlist (also the CORS policy), optional Cloudflare Turnstile, 256 KB body limit, and no file uploads in this phase. All outcomes are stored with a status; nothing is silently dropped and bots receive the same response as humans.

## Data

Submissions are deleted only by explicit user action or the plan's retention period. Test submissions are excluded from quotas. Structured logs carry ids, not payloads.

## Reporting

Found something? Use the contact form on the [about page](/about/#contact). We prefer coordinated disclosure and respond quickly.
