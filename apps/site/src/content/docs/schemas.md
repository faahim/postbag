---
title: "Schemas: observe, enforce, managed, versions, drift and inference"
description: "Postbag form schemas and stream schemas: immutable versions with JSON Schema and UI hints, the three schema modes, how drift is detected and resolved, and how inference proposes a schema from real submissions."
order: 23
section: Guides
---

A **form schema** is a versioned, immutable declaration of what a form collects: `json_schema` (JSON Schema draft 2020-12 for the submission `data`), `ui` (per-field label, placeholder, order, widget, help, options) and a `changelog`. **Stream schemas** have the same shape and are the outbound contract of a stream.

## Modes

| Mode | Behaviour |
|---|---|
| `observe` (default) | Accept everything. If a schema exists, compare and raise drift events. If none, infer one in the background and offer it. |
| `enforce` | Validate against the current version. Violations are stored `quarantined` with reason `schema_violation`, never rejected, and raise a drift event. |
| `managed` | Postbag owns the schema. `GET /s/{id}/schema` serves it (CORS open) and sites render the form from it. Validation as `enforce`. The site cannot drift because it has no schema of its own. |

## Publishing a version

```bash
POST /v1/forms/{id}/schema
{ "json_schema": { … }, "ui": { "email": { "label": "Email", "widget": "email", "order": 1 } }, "changelog": "v2" }
GET  /v1/forms/{id}/schema/versions
```

`form_schemas (form_id, version)` is unique and rows are never updated. Submissions record `form_schema_version`.

## Drift

A drift event is raised when what a form actually receives differs from its declared schema: `kind` is `new_field`, `missing_field` or `type_change`, with details and the triggering submission. `GET /v1/forms/{id}/drift` lists open events; publishing a new version or dismissing resolves them. Subscribe an organization webhook to `drift.detected` to be told without polling.

## Inference

`POST /v1/forms/{id}/schema/infer` builds a draft from recent submissions (field names, types, presence). Housekeeping does the same in the background for `observe` forms without a schema. Drafts are reviewed and published as a version; inferred versions carry an `inferred` flag.

## Embed snippets follow the schema

`GET /v1/forms/{id}/embed` renders HTML, fetch, React, Astro and Next.js snippets from the current schema's `ui` hints (label, widget, order), so a managed form's markup always matches its contract.
