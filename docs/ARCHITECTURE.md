# Architecture

How Postbag runs. Decisions with alternatives worth recording live in `decisions/`.

## Shape

```
                       ┌────────────────────────────────────────────┐
  HTML form / fetch ──►│  api       POST /s/{form}   (public, edge-ish) │
  agent / CLI / MCP ──►│            /v1/*            (management, keyed)│
  dashboard        ──►│            /app/*           (SPA, cookie auth) │
                       ├────────────────────────────────────────────┤
                       │  worker    drains deliveries, digests,      │
                       │            drift inference, retention        │
                       └───────────────┬────────────────────────────┘
                                       │
                                 ┌─────▼─────┐        ┌──────────────┐
                                 │ Postgres  │        │ Resend, Telegram,
                                 │ (truth)   │        │ webhooks …   │
                                 └─────┬─────┘        └──────────────┘
                                       │ attachment metadata
                                 ┌─────▼─────────────┐
                                 │ private S3-compatible│
                                 │ object storage       │
                                 └──────────────────────┘
```

One TypeScript monorepo (pnpm). One Docker image; `api` and `worker` are two
entrypoints of the same image (`postbag api`, `postbag worker`, or `postbag all`
for the single-container self-host). Postgres is the transactional source of truth.
Instances that accept attachments also configure private S3-compatible object storage;
the hosted service and a self-hosted instance use the same storage contract. See
[ADR-001](./decisions/ADR-001-stack.md) and
[ADR-010](./decisions/ADR-010-attachment-storage-and-admission.md).

### Packages

| Package         | Role                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core` | Pure domain: schema validation, mapping, routing decisions, spam heuristics, templates. No I/O. Fully unit-tested.                         |
| `packages/db`   | Drizzle schema, migrations, repositories. The only package that talks SQL.                                                                 |
| `apps/server`   | Hono app: public submit path, `/v1` management API, auth, serves the dashboard SPA. Worker loops live here too, behind an entrypoint flag. |
| `apps/web`      | Dashboard SPA (Vite + React), built into `apps/server` at image build. See [ADR-003](./decisions/ADR-003-dashboard-packaging.md).          |
| `packages/sdk`  | TypeScript client generated from the OpenAPI document.                                                                                     |
| `packages/cli`  | `postbag` CLI, thin over the SDK.                                                                                                          |
| `packages/mcp`  | MCP server, thin over the SDK.                                                                                                             |

## The submit path

`POST /s/{public_id}` — the hot path; it must be boring and fast.

1. Resolve form by `public_id` (cached). Unknown ⇒ 404. `paused` ⇒ 202, stored, not routed.
2. Parse a bounded body: `application/x-www-form-urlencoded`, `multipart/form-data`,
   `application/json`. Multipart accepts text fields and attachments, with a 16 MiB
   total-request ceiling. Strip control fields (`_redirect`, `_gotcha`, `_idempotency`, `_subject`).
3. Cheap checks, **all of which store the submission anyway** with a status:
   honeypot ⇒ `spam`; origin not allowed ⇒ `quarantined/origin_rejected`;
   rate limit ⇒ `quarantined/rate_limited`; Turnstile failed ⇒ `quarantined/turnstile_failed`.
4. Schema: in `enforce`/`managed`, validate; violation ⇒ `quarantined/schema_violation` + drift event. In `observe`, compare to current schema if any ⇒ drift event on difference. Never blocks.
5. For accepted attachments, write private objects under opaque keys, then **one
   transaction:** insert the submission and tenant-scoped attachment metadata; compute
   applicable routes (direct + via streams, respecting `enabled`, `window`, `quality`);
   insert one `delivery` row per route (`pending`, or `skipped` with reason); insert
   `submission.received`. A transaction failure queues uploaded objects for deletion.
6. Respond. JSON clients get `{ ok, submission_id }`. HTML posts get `303` to `_redirect` / `settings.redirect_url` / a hosted "thanks" page.
7. `NOTIFY postbag_deliveries` so an idle worker wakes immediately.

No destination network call happens in steps 1–6. Attachment storage is part of the
durable receipt path, not Delivery. Turnstile verification is the one external
validation exception and is bounded by a short timeout with fail-open-to-quarantine.

## The worker

- Claims work with `SELECT … FOR UPDATE SKIP LOCKED` on `deliveries WHERE status IN ('pending','failed') AND next_attempt_at <= now()`. Multiple workers are safe by construction. See [ADR-002](./decisions/ADR-002-outbox-as-queue.md).
- Applies mapping + transform (already snapshotted into `payload` at creation; re-snapshotted on manual retry), calls the destination adapter, records `response`, moves status. Backoff: `min(2^attempts * 30s ± jitter, 6h)`; `dead` after a per-type max (email 8, webhook 10, telegram 8).
- `dead` raises `delivery.dead` and a dashboard alert; alert storms are throttled per destination.
- Digest loop: once per period per digest route, builds one delivery grouping the period's submissions; keyed by the unique `(route_id, period_key)`.
- Housekeeping: schema inference for `observe` forms, retention deletion, durable
  attachment-object deletion retries, destination health (`failing` after N consecutive failures).
- Wakes on `LISTEN postbag_deliveries`, and on a 15 s tick regardless — **realtime is an accelerator, never the transport.**

### Destination adapters

```ts
interface DestinationAdapter<C> {
  type: string
  configSchema: ZodType<C> // validates + documents config
  redactConfig(c: C): Partial<C> // what the API may echo back
  test(c: C, sample: Payload): Promise<Result>
  deliver(c: C, payload: Payload, ctx: DeliveryContext): Promise<Result>
}
```

Adding a destination type is adding one file implementing this. `webhook` is the
reference implementation and the universal escape hatch.

### Webhook contract (outbound)

```
POST {url}
Content-Type: application/json
Postbag-Signature: t=1724200000,v1=<hex hmac-sha256(secret, "{t}.{body}")>
Postbag-Delivery: dl_…
Postbag-Event: submission.received | digest.ready | …

{ "id": "dl_…", "type": "submission.received", "schema_version": 3,
  "stream": { "id": "st_…", "slug": "vending-leads" } | null,
  "form":   { "id": "fm_…", "slug": "kontorsautomat-contact" },
  "data":   { …mapped payload… },
  "attachments": [{ "id": "fl_…", "field_name": "screenshot", "filename": "screen.png",
    "content_type": "image/png", "size_bytes": 42812, "sha256": "…",
    "download_url": "https://…", "expires_at": "2026-08-31T12:00:00.000Z" }],
  "meta": { … } }
```

`download_url` is a short-lived signed download URL, never a public object URL or binary
attachment. 2xx = sent. 410 = destination disabled itself. Anything else retries.

## Multi-tenancy

`organization_id` on every tenant table; repositories take an `OrgScope` and refuse
to run without one. Postgres row-level security is enabled as a second fence with
`SET LOCAL app.org_id` per request/transaction. Public submit runs outside RLS on
a narrow, audited path. Plan limits are checked at creation (forms, destinations)
and counted per month (submissions) with soft-fail: over-limit submissions are
stored and flagged `over_quota`, not dropped (Principle 4), and delivery is paused
until the plan allows. Attachment bytes are a separate aggregate-storage admission
boundary: a request that cannot fit in durable retained capacity never becomes a
Submission. Objects awaiting confirmed deletion remain in that capacity calculation,
so a storage outage cannot turn the deletion queue into an unbounded quota bypass. The
submit path durably reserves each object in that queue before writing bytes, then
atomically replaces the reservation with attachment metadata when the Submission
commits. The bound is documented in ADR-010.

Polar billing follows the same durability rule. `POST /v1/billing/webhook` verifies the
Standard Webhooks signature, stores one `billing_events` row per provider event id, and
then wakes the retryable processor. The processor alone updates billing metadata and a
billed plan; checkout success redirects are presentation only. Self-hosted instances
without `POLAR_ACCESS_TOKEN` provision organizations on the `selfhost` plan and return
`billing_disabled` from checkout and portal routes.

## Spam

Defence in depth, none of it destructive: honeypot, per-form rate limit, origin
allowlist, Turnstile (optional), heuristic score (link density, known patterns,
disposable email domains). `spam` is a status, visible and reversible; routes
exclude it by default. ML scoring later, fed by user "not spam" / "spam" actions.

## Email deliverability

All email goes through Resend from `notify@postbag.dev` (hosted) or the self-host's
configured domain, with `Reply-To` set from the submission so replying "just works".
Per-organization verified sending domains are Phase 3; until then, no user-supplied
`From`.

## Auth

Better Auth with the organization plugin (users, orgs, memberships, invitations)
and API keys. Dashboard uses cookie sessions; everything else uses
`Authorization: Bearer pb_live_…`. API keys are hashed (SHA-256) at rest and
scoped. Self-host can disable signups and run single-org.

## Observability

Structured JSON logs with `org_id`, `form_id`, `delivery_id` on every line.
`/health` reports db, worker heartbeat, oldest pending delivery age. OpenTelemetry
traces optional. Every org sees its own `events` stream — observability is a
product feature, not just ops.

## What we are deliberately not doing (yet)

- No Redis, no external queue. The outbox is the queue.
- No form builder. No hosted form pages beyond a plain "thanks" page.
- No per-org custom domains for the submit URL until there is demand.
- No multi-region. A single Postgres is correct; make it fast later.
- No attachment previews, malware scanning, resumable uploads or client-direct object
  uploads in the first attachment release.
