---
title: "Routing: forms, streams, mappings, routes, digests and windows"
description: "How Postbag routes submissions: direct routes, streams with explicit and tag-based sources, field mappings (from, const, default), versioned stream schemas, route modes (instant, digest with cron and timezone), delivery windows and quality rules."
order: 22
section: Guides
---

A **route** goes from a source (one form or one stream) to one destination, with rules. A **stream** groups forms and gives them one versioned output schema. A **mapping** turns a form's fields into the stream's fields.

## Direct routes

```bash
POST /v1/routes { "form_id": "fm_…", "destination_id": "ds_…" }
```

Defaults: `mode: { "type": "instant" }`, `quality: { "exclude_spam": true, "exclude_quarantined": true }`, `enabled: true`.

## Streams and sources

```bash
POST /v1/streams { "name": "Vending leads", "slug": "vending-leads",
  "schema": { "json_schema": { "type": "object", "required": ["name", "phone"], "properties": { … } } },
  "sources": [ { "selector": "tag:vending", "mapping": { … } }, { "form_id": "fm_…", "mapping": { … } } ] }
```

Sources are explicit (`form_id`) or selectors (`tag:vending`, `project:prj_…`). Each carries a mapping. `GET /v1/streams/{id}/preview` shows recent submissions mapped through the current mappings.

## Mappings

```json
{ "name": { "from": "fullName" }, "company": { "from": "Företag" },
  "phone": { "from": "tel", "default": null }, "site": { "const": "kontorsautomat.se" } }
```

Exactly one of `from`, `const` or `expr` per field. `expr` (JSONata, ADR-005) is reserved and currently returns `422 expressions_not_enabled` with a hint to use `from`, `const` or `default`. Unmapped form fields are kept under `extras`. A mapping is `valid` or `incomplete`; incomplete blocks attachment with `422 mapping_incomplete` listing the missing fields.

## Stream schemas

Versioned and immutable, like form schemas. Publishing a new version emits `stream.schema.changed` and re-validates every source mapping. Deliveries record the `schema_version` their payload conforms to.

## Route rules

| Rule | Shape | Effect |
|---|---|---|
| `mode` | `{ "type": "instant" }` or `{ "type": "digest", "cron": "0 8 * * *", "timezone": "Europe/Stockholm" }` | Digest groups a period into one delivery per destination, unique by (route, period). Empty periods send nothing. |
| `window` | `{ "from": ISO, "until": ISO }` (each nullable) | Outside the window the delivery is created as `skipped` with reason `window`. |
| `quality` | `{ "exclude_spam", "exclude_quarantined" }` | Both default `true`; skipped deliveries carry reason `quality`. |
| `enabled` | boolean | Disabled routes plan no deliveries. |
| `filter`, `transform` | expression strings | Reserved for the expression phase; accepted by the schema, not yet evaluated. |

## Deliveries

One row per (submission, route). Statuses: `pending`, `sending`, `sent`, `failed`, `dead`, `skipped`. Each keeps `payload` (the snapshot actually sent), `schema_version`, `attempts`, `next_attempt_at`, `last_error`, and the last `response` (status, body excerpt, latency). Retry with `POST /v1/deliveries/{id}/retry`.
