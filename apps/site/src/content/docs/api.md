---
title: "API overview: the complete Postbag contract"
description: "Authentication, public sandbox capabilities, resources, pagination, idempotency, errors, and published clients for the Postbag /v1 API."
order: 11
section: Reference
modified: "2026-08-24"
---

`GET /openapi.json` is generated from the live route definitions and is the source of truth. The dashboard, CLI, SDK, MCP server, and agents are clients of the same API. There is no UI-only capability.

## Authentication

Tenant calls accept `Authorization: Bearer pb_live_…` or a dashboard session cookie. API keys belong to one Organization, are shown once, stored hashed, and carry scopes: `manage` includes `read`, and `read` includes `submit`. `GET /v1/me` returns the active Organization, scope, limits, and usage.

Public sandbox creation needs no credentials. Its creation response includes a `sandbox_token` that is shown only once. The token remains reusable for that sandbox until claim or expiry:

```text
GET /v1/public/sandboxes/{id}
Authorization: Sandbox <sandbox_token>
```

Claiming requires both a manage-scoped actor and the sandbox capability:

```text
POST /v1/sandboxes/{id}/claim
Authorization: Bearer pb_live_…
Postbag-Sandbox-Token: <sandbox_token>
```

Google and GitHub OAuth are optional browser authentication methods. API keys and email-code authentication are the portable agent path.

## Request conventions

- **Self-describing ids:** `prj_` Project, `fm_` Form, `sb_` Submission, `st_` Stream, `ds_` Destination, `rt_` Route, and `dl_` Delivery.
- **Error envelope:** `{ "error": { "code", "message", "hint", "docs", "details"? } }`. Follow `hint`; `docs` links to the [error reference](/docs/errors/).
- **Next actions:** onboarding and guided create responses include `next[]` with relevant follow-up calls and bodies. Use the OpenAPI response Schema for each operation.
- **Idempotency:** send `Idempotency-Key` on `POST` requests you may retry. Reusing a key with a different body returns `409 idempotency_conflict`.
- **Existing resources:** supported creates accept `if_exists: "return"` to return the matching resource instead of failing.
- **Pagination:** list operations use opaque `cursor` values and `limit` up to 200, then return `next_cursor`.

## Resources

| Resource                   | Main paths                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Discovery                  | `GET /v1/me`, `POST /v1/quickstart`, `GET /llms.txt`, `GET /openapi.json`                                |
| Public sandboxes           | `POST /v1/public/sandboxes`, `GET /v1/public/sandboxes/{id}`, `POST /v1/sandboxes/{id}/claim`            |
| Projects                   | `GET/POST /v1/projects`, `GET/PATCH/DELETE /v1/projects/{id}`                                            |
| Forms                      | `GET/POST /v1/forms`, `GET/PATCH/DELETE /v1/forms/{id}`, embed, Schema versions, inference, and Drift    |
| Submissions                | `GET /v1/forms/{id}/submissions`, `GET /v1/submissions`, `GET/PATCH /v1/submissions/{id}`                |
| Streams                    | `GET/POST /v1/streams`, Stream Schema, sources, and preview operations                                   |
| Destinations               | `GET/POST /v1/destinations`, `GET/PATCH/DELETE /v1/destinations/{id}`, `POST /v1/destinations/{id}/test` |
| Routes                     | `GET/POST /v1/routes`, `GET/PATCH/DELETE /v1/routes/{id}`                                                |
| Deliveries                 | `GET /v1/deliveries`, `GET /v1/deliveries/{id}`, `POST /v1/deliveries/{id}/retry`                        |
| Events and system webhooks | `GET /v1/events`, webhook configuration, and webhook Delivery history                                    |
| API keys                   | `GET/POST/DELETE /v1/api-keys`                                                                           |
| Public Form intake         | `POST /s/{formId}`, `GET /s/{formId}/schema`                                                             |

Use the OpenAPI document for every complete request and response Schema. This page explains the operating conventions around it.

## Receiving and Delivery are separate

`POST /s/{formId}` stores a Submission before Postbag considers Delivery. A Form needs a Destination and Route before a new Submission can create Deliveries.

The anonymous sandbox path never creates outbound traffic. After claim, copied test Submissions stay inert. Create the Destination and Route, then send a new Submission to verify Delivery.

## Events and system webhooks

The Organization event log is append-only. Event types include `submission.received`, `submission.quarantined`, `delivery.sent`, `delivery.dead`, `form.schema.changed`, `stream.schema.changed`, `drift.detected`, and `destination.failing`.

Organization-level system webhooks are distinct from Route Destinations. They subscribe to product events, and Postgres triggers their dispatch so consumers can learn about changes without polling. Inspect attempts at `GET /v1/webhooks/{id}/deliveries`.

## Published clients

The TypeScript SDK is generated from OpenAPI and used by the dashboard:

```bash
npm install @postbag/sdk
```

```ts
import { createClient } from "@postbag/sdk"

const client = createClient({
  baseUrl: "https://postbag.dev",
  apiKey: process.env.POSTBAG_API_KEY,
})

const { data, error } = await client.GET("/v1/forms")
```

The command-line and MCP clients are published too:

```bash
npm install --global postbag
npx -y @postbag/mcp
```

All three clients use the same paths, operation ids, and error envelope as the raw API.
