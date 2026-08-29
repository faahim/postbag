# Domain model

```
Organization ─┬─ Membership ── User
              ├─ ApiKey
              ├─ Project ── Form ─┬─ FormSchema (v1, v2, …)
              │                   └─ Submission ── attachment metadata
              │                                  └─ Delivery ─┐
              ├─ Stream ─┬─ StreamSchema (v1, v2, …)          │
              │          ├─ StreamSource (form ↔ stream + Mapping)
              │          └─ Route ── Destination ◄────────────┘
              ├─ Route (form → destination, the simple case)
              ├─ Destination
              ├─ Event (audit + org webhooks)
              ├─ BillingEvent (verified Polar subscription event queue)
              └─ DriftEvent

AnonymousSandbox ── AnonymousSubmission
        │
        └── claim ──► Organization / Project / Form / Submission
```

Tenancy: **every tenant-owned row carries `organization_id`** and every query is
scoped by it. Anonymous sandbox staging rows are deliberately non-tenant and can
only be addressed with their hashed capability token; claiming moves their data
into tenant-owned rows atomically.
IDs are prefixed public ids (`fm_…`, `sb_…`, `fl_…`, `st_…`, `ds_…`, `rt_…`, `dl_…`) so an
id is self-describing in logs, URLs, and agent conversations.

---

## Organization

The tenant. Owns everything below. Has a `slug`, a `plan`, and limits derived from
the plan (forms, submissions/month, retention days, destinations, attachment size,
attachments per Submission and retained attachment storage). `plan_source`
records whether access is free, billed, complimentary, or self-hosted. Polar customer,
subscription, status, renewal date, and cancellation state are stored on the settings
row; only a processed, signed Polar subscription webhook may change a billed plan.

**Membership** links a User with a role: `owner | admin | member`. **ApiKey** is
org-scoped, shown once, stored hashed, with a visible prefix (`pb_live_…`,
`pb_test_…`) and scopes (`manage` | `read` | `submit`). Keys are how agents, the
CLI and the MCP server authenticate.

**BillingEvent** is the durable, idempotent inbox for Polar `subscription.*` webhooks.
The Standard Webhooks id is unique, the raw verified payload is retained, and a worker
applies plan changes with retry state. Checkout redirects never grant entitlements.

## Project

A folder. Nothing more. Groups forms for humans (a client, a niche, a site). Has
`slug`, `name`, `tags[]`. **Projects are never a routing boundary** — routing is
done by Streams. A "Default" project exists from signup.

## Form

The thing a website posts to. Identified publicly by `public_id` (`fm_8f3kq2`),
which appears in the submit URL and is not secret.

| Field                        | Notes                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `slug`, `name`, `tags[]`     | `tags` are how streams select forms in bulk (`tag:vending`).                                                |
| `schema_mode`                | `observe` (default) · `enforce` · `managed`. See _FormSchema_.                                              |
| `current_schema_version`     | Null until a schema exists.                                                                                 |
| `settings.allowed_origins[]` | CORS + Origin/Referer check. Empty = any.                                                                   |
| `settings.redirect_url`      | Where HTML (non-JS) posts are sent after a 303. Can be overridden per-submit by `_redirect`.                |
| `settings.honeypot_field`    | Default `_gotcha`. Non-empty value ⇒ flagged spam, still stored.                                            |
| `settings.turnstile`         | Optional Cloudflare Turnstile secret; verified server-side.                                                 |
| `settings.rate_limit`        | Per-IP per-form, with a burst. Overflow ⇒ stored as `quarantined`, reason `rate_limited`.                   |
| `settings.reply_to_field`    | Which submitted field becomes Reply-To on email deliveries (default: first field that looks like an email). |
| `status`                     | `active` · `paused` (paused forms store but do not deliver).                                                |

A form can be attached to zero or more streams and can have direct routes of its own.

## Sandbox

A temporary, unclaimed Form used to prove receipt before a person creates or signs
into an account. It keeps the final `fm_…` public id and submit URL, expires after
24 hours, accepts at most five Submissions of at most 16 KiB and never creates a
Destination or Delivery.

The capability token is shown once, stored only as a keyed hash and required to read
or claim the sandbox. A separately encrypted copy exists only so an idempotent create
retry can replay the original response. A claim-email hash may bind the sandbox to
the verified email of the claimant; the raw email is not stored.

Claiming locks the sandbox, resolves a real Project, creates the tenant-owned Form
with the same public id, copies accepted rows as test Submissions with their original
ids and timestamps, then consumes the token. New submissions use the normal Form
path; copied test Submissions never retroactively create Deliveries. Expired,
unclaimed sandboxes are deleted by the explicit retention job. See
[ADR-008](./decisions/ADR-008-anonymous-claimable-quickstart.md) and
[ADR-009](./decisions/ADR-009-anonymous-admission-boundary.md).

## FormSchema

A **versioned, immutable** declaration of what a form collects. New version = new
row; the form's `current_schema_version` moves. Each version holds:

- `json_schema` — standard JSON Schema (draft 2020-12) for the submission `data`.
- `ui` — per-field hints for rendering: label, placeholder, order, widget, help,
  options. Used by `managed` forms and by the dashboard.
- `changelog` — free text, who/when.

Modes, set on the form:

| Mode      | Behaviour                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observe` | Accept everything. If a schema exists, compare and raise **drift** events; if none, infer one in the background and offer it. Default.                                                            |
| `enforce` | Validate against the current schema. Violations are stored as `quarantined` with reason `schema_violation` — never rejected, never dropped — and raise a drift event.                             |
| `managed` | Postbag owns the schema. `GET /s/{public_id}/schema` serves it (CORS open) and sites render the form from it. Validation as `enforce`. The site cannot drift because it has no schema of its own. |

## Submission

One received payload.

| Field                 | Notes                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `public_id`           | `sb_…`                                                                                                                                                                                                 |
| `data`                | JSON object of submitted fields, after stripping control fields (`_redirect`, `_gotcha`, …). A multipart attachment is replaced at its field by its `fl_…` id (or ids for repeated fields).            |
| `attachments`         | Additive metadata for each referenced `fl_…`: field, display filename, content type, byte size and checksum. It is tenant-scoped; the private object key is never part of `data` or a public response. |
| `form_schema_version` | Version validated against, or null.                                                                                                                                                                    |
| `status`              | `received` · `quarantined` · `spam`. All three are stored and visible.                                                                                                                                 |
| `quarantine_reason`   | `schema_violation` · `rate_limited` · `origin_rejected` · `turnstile_failed` · `over_quota`.                                                                                                           |
| `spam`                | `{ score, reasons[] }` — honeypot, heuristics, later ML.                                                                                                                                               |
| `meta`                | `ip`, `user_agent`, `origin`, `referer`, `country`, `received_at`, `content_type`.                                                                                                                     |
| `idempotency_key`     | From the `Idempotency-Key` header or `_idempotency` field. Unique per form.                                                                                                                            |

Unique: `(form_id, idempotency_key)`.

Attachment bytes live in private S3-compatible object storage, while their metadata is
stored with the owning Organization and Submission. An authenticated API or dashboard
request resolves an attachment to a short-lived signed download URL. Email, Telegram
and webhook Deliveries receive the same short-lived links rather than binary files.
Attachments are deleted with their Submission; a durable retry queue removes an
object if the first deletion attempt fails. Anonymous sandboxes do not accept
attachments. The first release deliberately excludes previews, scanning, resumable
uploads and client-direct uploads.

## Stream

A named group of forms with a **shared output shape**. This is the operator's
primary object: "all vending leads", "all AI-app signups". Has `slug`, `name`,
`current_schema_version`.

**StreamSource** attaches forms to a stream, either explicitly (`form_id`) or by
selector (`tag:vending`, `project:prj_…`). Each source carries a **Mapping**.

## StreamSchema

Versioned, immutable, same shape as FormSchema (`json_schema` + `ui`). This is the
**outbound contract**: what every route on the stream delivers. Changing it is a
deliberate act that creates a new version, emits `stream.schema.changed`, and
re-validates every source mapping.

**Version 1 is usually derived, not written.** Attaching the first source (a `form_id`)
to a stream with no schema publishes version 1 copied from that form — its published
schema, else its inferred draft, else the fields seen in its recent submissions — and
gives the form an identity mapping. The changelog records where it came from. A stream
that can't derive anything (selector source, or a form with no schema and no
submissions) rejects the attach with `stream_schema_missing` rather than publishing an
empty shape. Later versions are published explicitly.

## Mapping

Per (stream, form): how that form's fields produce the stream schema's fields.

```jsonc
{
  "name": { "from": "fullName" }, // direct
  "company": { "from": "Företag" },
  "phone": { "from": "tel", "default": null },
  "site": { "const": "kontorsautomat.se" }, // literal
  "message": { "expr": "$join([subject, body], '\n\n')" }, // expression (Phase 2)
}
```

The Mapping determines the Delivery payload. Form fields it does not use remain on the original Submission; the Stream preview returns those unused values under `extras` so nothing is silently lost.
A mapping is `valid` or `incomplete` (a required stream field has no source); an
incomplete mapping blocks attachment and is reported immediately — to the dashboard
and to the agent making the call — not at delivery time.

## Destination

Somewhere submissions can go. Org-scoped and reusable across routes.

| Type                   | Config                                          | Notes                                                                                                        |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `email`                | `to[]`, `cc[]`, `subject_template`, `from_name` | Sent via Resend from a Postbag domain, Reply-To set from the submission. Per-org sending domains in Phase 3. |
| `telegram`             | `bot_token`, `chat_id`, `template`              | Bot API. `/start` pairing flow in dashboard later.                                                           |
| `webhook`              | `url`, `secret`, `headers{}`                    | POST JSON, HMAC-SHA256 signature header, timestamp, retries. **The universal extension point.**              |
| `slack`, `discord`     | incoming webhook url, template                  | Phase 2.                                                                                                     |
| `dekhval`, `smedja`, … | native                                          | Phase 3, and only once the webhook path has proven the need.                                                 |

Secrets in `config` are encrypted at rest with an org-independent KMS key. A
destination can be **tested** (`POST /v1/destinations/{id}/test`) with a sample
payload — this is the agent's verification step.

## Route

`source → destination` with rules. Source is **either** a form **or** a stream.

| Field       | Notes                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `filter`    | Expression over the (mapped) payload; falsey ⇒ delivery `skipped`. Phase 2.                                        |
| `transform` | Template/expression producing the destination payload. Default identity. Phase 2.                                  |
| `window`    | `{ from, until }` timestamps; outside the window ⇒ `skipped`. Ships Phase 1 — it is what the HonestBox case needs. |
| `mode`      | `instant` (default) · `digest { cron, timezone }`.                                                                 |
| `quality`   | Minimum quality bar: e.g. `exclude_spam: true`, `exclude_quarantined: true` (defaults true/true).                  |
| `enabled`   |                                                                                                                    |

## Delivery

The **outbox**. One row per (submission, route), created transactionally with the
submission's routing, drained by the worker.

| Field                                       | Notes                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`                                    | `pending` · `sending` · `sent` · `failed` (will retry) · `dead` (gave up, alert raised) · `skipped` (filter/window/quality).                                                        |
| `attempts`, `next_attempt_at`, `last_error` | Exponential backoff with jitter; max attempts per destination type.                                                                                                                 |
| `payload`                                   | Snapshot of exactly what was (or will be) sent, after mapping + transform. Attachment references remain `fl_…`; adapters add short-lived signed download links, never binary files. |
| `schema_version`                            | Stream schema version (or form schema version for direct routes) the payload conforms to.                                                                                           |
| `response`                                  | Status, truncated body, latency of the last attempt.                                                                                                                                |
| `dedupe_key`                                | `"{submission_id}:{route_id}"` — **unique**.                                                                                                                                        |

Digest routes create a **Digest** row keyed `(route_id, period_key)` — unique — and
deliveries are grouped under it.

## Event and DriftEvent

`Event` is the org's append-only log: `submission.received`, `submission.quarantined`,
`delivery.sent`, `delivery.dead`, `form.schema.changed`, `stream.schema.changed`,
`drift.detected`, `destination.failing`. Org-level **system webhooks** (distinct from
route destinations) can subscribe to any event type — this is how Dekhval or Smedja
learn that a schema changed without polling.

`DriftEvent` is the structured record behind `drift.detected`: form, submission,
`kind` (`new_field` · `missing_field` · `type_change`), details, and `resolved_at`
once a human or agent has published a new schema version or dismissed it.

---

## Invariants (database-enforced)

1. `submissions (form_id, idempotency_key)` unique.
2. `deliveries (submission_id, route_id)` unique.
3. `digests (route_id, period_key)` unique.
4. `form_schemas (form_id, version)` and `stream_schemas (stream_id, version)` unique; rows never updated.
5. Every tenant-owned row has a non-null `organization_id`, and every foreign key across tenant tables is checked to be within the same organization (composite FK or trigger).
6. Attachment metadata is tenant-scoped and may only reference a Submission in that
   same Organization. Object keys are opaque and private.
7. Attachment-object deletion retries are durable and survive Submission deletion.
8. Anonymous sandbox rows are non-tenant staging rows; capability-token checks and
   the atomic claim transaction are their ownership boundary.
