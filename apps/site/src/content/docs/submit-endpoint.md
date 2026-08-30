---
title: "Submit endpoint reference: POST /s/{formId}"
description: "Everything about the Postbag submit endpoint: accepted content types, multipart attachments, control fields (_redirect, _gotcha, _test, _idempotency, _subject), responses, CORS, rate limits, body limits, and how each outcome is stored."
order: 10
section: Reference
---

`POST /s/{formId}` is the hot path. It is public (no auth), boring on purpose, and never makes a third-party network call except optional Turnstile verification.

## Content types

| Content-Type                        | Notes                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `application/x-www-form-urlencoded` | Default for HTML forms. Repeated keys become arrays.                                                                                         |
| `multipart/form-data`               | Text fields and attachments. Each attachment is represented in Submission `data` by an `fl_…` id and listed in additive attachment metadata. |
| `application/json`                  | Any JSON object. Nested objects are stored as-is.                                                                                            |

`application/json` and `application/x-www-form-urlencoded` are limited to **256 KB**.
Multipart requests are limited to **16 MiB total**, including text fields and all
attachments; larger requests return `413 payload_too_large`.

Attachment capacity is part of the Organization's plan: Free allows **2 MiB per
attachment, 3 per Submission and 100 MiB retained**; Pro allows **10 MiB, 10 and
10 GiB**; Team allows **15 MiB, 20 and 100 GiB**. The 16 MiB request ceiling is an
independent aggregate limit: many small files may fit, but the per-file maximum cannot
be repeated up to the count maximum in one request. A self-host can configure its own
limits. Anonymous sandbox Forms never accept attachments.

```html
<input type="file" name="screenshot" accept="image/*" />
```

For example, the completed Submission has `data.screenshot: "fl_…"` and an
`attachments` entry with its display filename, type and byte size. The `fl_…` id is
what agents and mappings carry; a private storage key is never exposed.

## Control fields

Fields starting with `_` are stripped from `data` and interpreted:

| Field          | Effect                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `_redirect`    | Where to send an HTML (non-JS) post after a `303`. Overrides the form's `redirect_url` setting.                                     |
| `_gotcha`      | The honeypot (rename via `settings.honeypot_field`). A non-empty value stores the submission as `spam`.                             |
| `_test`        | `true` stores a test submission: routed like any other, excluded from quotas, and the response includes `deliveries[]` ids to poll. |
| `_idempotency` | Same as the `Idempotency-Key` header: unique per form; a repeat returns the original submission with `idempotent: true`.            |
| `_subject`     | Optional subject hint for email destinations.                                                                                       |

## Responses

| Client       | Success                                                         | Notes                                                                                                      |
| ------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| JSON / fetch | `200 { ok, submission_id, status, deliveries? }`                | `status` is `received`, `quarantined` or `spam`. Spam and quarantine still answer 200; bots learn nothing. |
| HTML form    | `303` to `_redirect` → form `redirect_url` → hosted thanks page |                                                                                                            |
| Paused form  | `202`, stored, not routed                                       |                                                                                                            |
| Unknown form | `404 not_found`                                                 |                                                                                                            |
| Rate limited | `429 rate_limited` (and stored as `quarantined`)                | `Retry-After` set.                                                                                         |

Every error body is `{ "error": { "code", "message", "hint", "docs" } }`. See [Error codes](/docs/errors/).

## What the endpoint checks, in order

1. Resolve the form (cached). Unknown → 404. `paused` → stored, not routed.
2. Bound and parse the body, validate attachment count, size and retained-storage
   admission, then strip control fields. A request that cannot fit in durable
   attachment capacity is not accepted as a Submission.
3. Cheap checks that all **store anyway** with a status: honeypot → `spam`; origin not in `settings.allowed_origins` → `quarantined/origin_rejected`; over `settings.rate_limit` → `quarantined/rate_limited`; Turnstile failed → `quarantined/turnstile_failed`.
4. Schema: in `enforce` and `managed` modes, validate; a violation stores `quarantined/schema_violation` and raises a drift event. In `observe`, compare to the current schema if any and raise drift on differences. Never blocks.
5. For accepted multipart attachments, write private objects under opaque keys, then
   one transaction: insert the Submission and attachment metadata, plan one Delivery
   per applicable route (direct and via streams, respecting `enabled`, `window`,
   `quality`), and write `submission.received`. If that transaction cannot commit,
   uploaded objects are queued for durable deletion retry.
6. Respond, then `NOTIFY postbag_deliveries` so an idle worker wakes immediately.

## CORS

`settings.allowed_origins` doubles as the CORS allowlist for fetch-based submissions. Postbag compares canonical origins: paths and trailing slashes are ignored, host casing is normalized, and default ports are equivalent. Non-default ports remain distinct. Empty means any origin may post (`Access-Control-Allow-Origin: *`). `GET /s/{formId}/schema` (managed forms) is always CORS-open.

## Metadata stored with each submission

`ip` (from `CF-Connecting-IP`, then the first `X-Forwarded-For` hop, then the socket), `user_agent`, `origin`, `referer`, `country` (from Cloudflare when present), `received_at`, `content_type`, and the form schema version validated against, if any.

Attachment metadata is tenant-scoped. The dashboard and authenticated API issue
short-lived downloads; email, Telegram and webhook Deliveries receive short-lived
signed links rather than binary files. Attachments are deleted with their Submission,
with failed object deletions retried durably and still counted toward retained storage
until deletion succeeds. The first release does not scan,
preview, resume or accept direct-to-storage uploads.
