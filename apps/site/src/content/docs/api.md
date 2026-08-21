---
title: "API overview: resources, conventions, pagination, idempotency"
description: "The Postbag /v1 API: authentication with pb_live_ keys and scopes, every resource (projects, forms, submissions, streams, destinations, routes, deliveries, events, webhooks), cursor pagination, Idempotency-Key, if_exists, and the error envelope. The OpenAPI document is the contract."
order: 11
section: Reference
---

The OpenAPI document at `GET /openapi.json` is generated from the live route definitions and is the source of truth. Dashboard, SDK and agents are clients of the same API; there is no UI-only capability.

## Authentication

`Authorization: Bearer pb_live_…` (or a dashboard session cookie). Keys are organization-scoped, shown once, stored hashed, and carry scopes: `manage` ⊇ `read` ⊇ `submit`. `GET /v1/me` tells you which.

## Conventions

- **Ids are prefixed and self-describing:** `prj_` project, `fm_` form, `sb_` submission, `st_` stream, `ds_` destination, `rt_` route, `dl_` delivery.
- **Errors:** `{ "error": { "code", "message", "hint", "docs", "details"? } }`. `hint` says what to do; `docs` deep-links into [the error reference](/docs/errors/).
- **Every create returns `next[]`:** suggested follow-up calls with ready-to-send bodies.
- **`Idempotency-Key`** is honoured on every `POST` under `/v1`; replaying the same key with a different body returns `409 idempotency_conflict`.
- **`if_exists: "return"`** on creates makes them idempotent by `(project, slug)` or `(organization, slug)`.
- **Cursor pagination:** `?cursor=&limit=` (max 200), opaque cursors, `next_cursor` in the response.

## Resources

| Resource | Paths |
|---|---|
| Discovery | `GET /v1/me`, `POST /v1/quickstart`, `GET /llms.txt`, `GET /openapi.json` |
| Projects | `GET/POST /v1/projects`, `GET/PATCH/DELETE /v1/projects/{id}` |
| Forms | `GET/POST /v1/forms`, `GET/PATCH/DELETE /v1/forms/{id}`, `GET /v1/forms/{id}/embed`, `GET/POST /v1/forms/{id}/schema`, `GET /v1/forms/{id}/schema/versions`, `POST /v1/forms/{id}/schema/infer`, `GET /v1/forms/{id}/drift` |
| Submissions | `GET /v1/forms/{id}/submissions`, `GET /v1/submissions`, `GET /v1/submissions/{id}` |
| Streams | `GET/POST /v1/streams`, `GET/PATCH/DELETE /v1/streams/{id}`, `GET/POST /v1/streams/{id}/schema`, `GET/POST /v1/streams/{id}/sources`, `DELETE /v1/streams/{id}/sources/{sourceId}`, `GET /v1/streams/{id}/preview` |
| Destinations | `GET/POST /v1/destinations`, `GET/PATCH/DELETE /v1/destinations/{id}`, `POST /v1/destinations/{id}/test` |
| Routes | `GET/POST /v1/routes`, `GET/PATCH/DELETE /v1/routes/{id}` |
| Deliveries | `GET /v1/deliveries`, `GET /v1/deliveries/{id}`, `POST /v1/deliveries/{id}/retry` |
| Events and system webhooks | `GET /v1/events`, `GET/POST /v1/webhooks`, `GET/PATCH/DELETE /v1/webhooks/{id}`, `GET /v1/webhooks/{id}/deliveries` |
| API keys | `GET/POST/DELETE /v1/api-keys` |
| Public | `POST /s/{formId}`, `GET /s/{formId}/schema` |

## Events and system webhooks

The organization's append-only log: `submission.received`, `submission.quarantined`, `delivery.sent`, `delivery.dead`, `form.schema.changed`, `stream.schema.changed`, `drift.detected`, `destination.failing`. Organization-level system webhooks (distinct from route destinations) subscribe to any of these; dispatch is triggered from Postgres so a subscriber learns of a schema change without polling. Their deliveries are listed under `GET /v1/webhooks/{id}/deliveries`.

## SDK

`@postbag/sdk` is a TypeScript client generated from the OpenAPI document (openapi-typescript + openapi-fetch). It is used by the dashboard and will be published to npm together with the CLI and MCP server.
