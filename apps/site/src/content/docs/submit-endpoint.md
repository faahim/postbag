---
title: "Submit endpoint reference: POST /s/{formId}"
description: "Everything about the Postbag submit endpoint: accepted content types, control fields (_redirect, _gotcha, _test, _idempotency, _subject), responses, CORS, rate limits, the 256 KB body limit, and how each outcome is stored."
order: 10
section: Reference
---

`POST /s/{formId}` is the hot path. It is public (no auth), boring on purpose, and never makes a third-party network call except optional Turnstile verification.

## Content types

| Content-Type | Notes |
|---|---|
| `application/x-www-form-urlencoded` | Default for HTML forms. Repeated keys become arrays. |
| `multipart/form-data` | Text fields only in this phase; a file part returns `415 unsupported_media_type` with a hint. |
| `application/json` | Any JSON object. Nested objects are stored as-is. |

Maximum body size is **256 KB**; larger bodies return `413 payload_too_large`.

## Control fields

Fields starting with `_` are stripped from `data` and interpreted:

| Field | Effect |
|---|---|
| `_redirect` | Where to send an HTML (non-JS) post after a `303`. Overrides the form's `redirect_url` setting. |
| `_gotcha` | The honeypot (rename via `settings.honeypot_field`). A non-empty value stores the submission as `spam`. |
| `_test` | `true` stores a test submission: routed like any other, excluded from quotas, and the response includes `deliveries[]` ids to poll. |
| `_idempotency` | Same as the `Idempotency-Key` header: unique per form; a repeat returns the original submission with `idempotent: true`. |
| `_subject` | Optional subject hint for email destinations. |

## Responses

| Client | Success | Notes |
|---|---|---|
| JSON / fetch | `200 { ok, submission_id, status, deliveries? }` | `status` is `received`, `quarantined` or `spam`. Spam and quarantine still answer 200; bots learn nothing. |
| HTML form | `303` to `_redirect` → form `redirect_url` → hosted thanks page | |
| Paused form | `202`, stored, not routed | |
| Unknown form | `404 not_found` | |
| Rate limited | `429 rate_limited` (and stored as `quarantined`) | `Retry-After` set. |

Every error body is `{ "error": { "code", "message", "hint", "docs" } }`. See [Error codes](/docs/errors/).

## What the endpoint checks, in order

1. Resolve the form (cached). Unknown → 404. `paused` → stored, not routed.
2. Parse the body and strip control fields.
3. Cheap checks that all **store anyway** with a status: honeypot → `spam`; origin not in `settings.allowed_origins` → `quarantined/origin_rejected`; over `settings.rate_limit` → `quarantined/rate_limited`; Turnstile failed → `quarantined/turnstile_failed`.
4. Schema: in `enforce` and `managed` modes, validate; a violation stores `quarantined/schema_violation` and raises a drift event. In `observe`, compare to the current schema if any and raise drift on differences. Never blocks.
5. One transaction: insert the submission, plan one delivery per applicable route (direct and via streams, respecting `enabled`, `window`, `quality`), write `submission.received`.
6. Respond, then `NOTIFY postbag_deliveries` so an idle worker wakes immediately.

## CORS

`settings.allowed_origins` doubles as the CORS allowlist for fetch-based submissions. Empty means any origin may post (and the `Access-Control-Allow-Origin` echoes the request origin). `GET /s/{formId}/schema` (managed forms) is always CORS-open.

## Metadata stored with each submission

`ip` (from `CF-Connecting-IP`, then the first `X-Forwarded-For` hop, then the socket), `user_agent`, `origin`, `referer`, `country` (from Cloudflare when present), `received_at`, `content_type`, and the form schema version validated against, if any.
