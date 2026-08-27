---
title: "Architecture: the submit path, the outbox and the worker"
description: "How Postbag runs: one Hono server with a public submit path and the /v1 API, a worker that drains a Postgres outbox with SELECT … FOR UPDATE SKIP LOCKED, LISTEN/NOTIFY plus a 15-second tick, exponential backoff, digests, drift inference, retention, and multi-tenancy."
order: 30
section: Operate
---

One TypeScript monorepo, one Docker image, one Postgres. `api`, `worker` and `all` are entrypoints of the same image. Postgres is the only stateful dependency.

```
HTML form / fetch ──► POST /s/{form}      (public)
agent / CLI / MCP ──► /v1/*               (keyed)
dashboard         ──► /app/*              (SPA, cookie auth)
marketing/docs    ──► /                   (static)
                         │
                 worker: drains deliveries, digests, inference, retention
                         │
                     Postgres (truth) ──► Resend, Telegram, webhooks
```

## The submit path

Resolve form → parse → cheap checks that store anyway → schema → **one transaction** (submission + one delivery per route + event) → respond → `NOTIFY`. No third-party call in the write path; Turnstile is the bounded exception. Details in the [submit endpoint reference](/docs/submit-endpoint/).

## The worker

- Claims with `SELECT … FOR UPDATE SKIP LOCKED` on `deliveries WHERE status IN ('pending','failed') AND next_attempt_at <= now()`. Multiple workers are safe by construction.
- Applies the destination adapter, records `response`, moves status. Backoff `min(2^attempts × 30 s ± 20 %, 6 h)`; `dead` after 8 attempts (email, Telegram) or 10 (webhook). `dead` raises `delivery.dead` and a dashboard alert; storms are throttled per destination.
- Digest loop once a minute: for every (route, period) whose period has closed, one delivery per destination, keyed by the unique `(route_id, period_key)`.
- Housekeeping: schema inference for `observe` forms, retention deletion, destination health.
- Wakes on `LISTEN postbag_deliveries` and on a 15 s tick regardless. Realtime is an accelerator, never the transport.

## Destination adapters

```ts
interface DestinationAdapter<C> {
  type: string
  configSchema: ZodType<C>          // validates and documents config
  redactConfig(c: C): Partial<C>    // what the API may echo back
  test(c: C, sample: Payload): Promise<Result>
  deliver(c: C, payload: Payload, ctx: DeliveryContext): Promise<Result>
}
```

Adding a destination type is adding one file implementing this. Webhook is the reference implementation.

## Multi-tenancy

`organization_id` on every tenant table; repositories take an organization scope and refuse to run without one. Row-level security policies and a `postbag_app` role ship in the migrations as a second fence. Public submit runs on a narrow, audited path. Plan limits are checked at creation (forms, destinations) and counted per month (submissions) with soft-fail: over-limit Submissions are stored and flagged. After capacity returns, a manager explicitly releases each one to queue Delivery.

## Observability

Structured JSON logs with `org_id`, `form_id`, `delivery_id`. `/health` reports database, worker heartbeat and oldest pending delivery age. Every organization sees its own events stream: observability is a product feature.

## Deliberately not doing

No Redis or external queue (the outbox is the queue). No form builder. No multi-region until p95 submit latency from target markets exceeds 300 ms.
