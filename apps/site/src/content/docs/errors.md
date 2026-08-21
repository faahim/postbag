---
title: "Error codes"
description: "Every Postbag API error is { code, message, hint, docs }. This page lists each code, its HTTP status and the hint the API returns, so humans and agents can act on it."
order: 40
section: Reference
---

Every error response has the shape:

```json
{ "error": { "code": "mapping_incomplete", "message": "…", "hint": "Map every required stream field before attaching.",
             "docs": "https://postbag.dev/docs/errors/mapping_incomplete", "details": { … } } }
```

`hint` says what to do next. `docs` deep-links to the section below. `details` carries structured specifics (validation issues, missing fields, retry delay).

## Codes

| Code | Status | Hint |
|---|---|---|
| `unauthorized` | 401 | Provide a session cookie or an `Authorization: Bearer pb_live_…` key. |
| `forbidden` | 403 | Use credentials with permission for this operation (check key scopes). |
| `origin_rejected` | 403 | Add the site origin to the form's allowed origins. The submission was still stored as quarantined. |
| `not_found` | 404 | Check the id and organization scope. |
| `conflict` | 409 | The resource already exists, or is still referenced elsewhere. Consider `if_exists: "return"`. |
| `idempotency_conflict` | 409 | Reuse an `Idempotency-Key` only for the identical operation. |
| `plan_limit_reached` | 402 | Change plan limits or remove an unused resource. |
| `payload_too_large` | 413 | Reduce the payload size, field count, or nesting depth (limit 256 KB). |
| `unsupported_media_type` | 415 | File uploads are not supported yet; send text fields only. |
| `validation_failed` | 422 | Correct the fields described in `details.issues` and retry. |
| `mapping_incomplete` | 422 | Map every required stream field before attaching; `details` lists them. |
| `stream_schema_missing` | 422 | The stream has no schema and the attached source can't provide one. Attach a form that has a published schema or a submission (its fields become version 1), or `POST /v1/streams/{id}/schema`. |
| `schema_violation` | 422 | Publish a compatible schema or correct the submitted fields. |
| `expressions_not_enabled` | 422 | Use `from`, `const` or `default` until expressions ship. |
| `rate_limited` | 429 | Retry after the indicated delay (`Retry-After`). The submission was stored as quarantined. |
| `internal_error` | 500 | Retry; contact support if this persists. |
