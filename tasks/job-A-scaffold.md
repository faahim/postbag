# Job A — Monorepo scaffold, database schema, pure domain core, auth package

You are implementing the foundation of **Postbag** at `/Users/faahim/Developer/postbag`
(branch `main`, already checked out — do NOT run any git commands; leave changes in the
working tree and finish with a list of files you created/changed).

## Read first (in this order, fully)
1. `CLAUDE.md` — golden rules. Rule 4 (vocabulary), 5 (immutable schema versions), 6 (org scoping) apply directly here.
2. `docs/PRINCIPLES.md` §3 vocabulary and §4 never-lose-a-submission.
3. `docs/DOMAIN-MODEL.md` — the tables you are creating. Treat it as the spec.
4. `docs/ARCHITECTURE.md` — packages table, submit path, worker, adapters, tenancy.
5. `docs/decisions/ADR-001-stack.md`, `ADR-002-outbox-as-queue.md`, `ADR-004-two-schema-layers.md`.
6. `api/openapi.yaml` — component schemas define the JSON shapes; your types must match them.

Design is decided. Do not re-litigate it; if something in the docs is impossible, pick the
closest faithful option and say so in your final report.

## Your file boundary (create/edit only these)
- Root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.npmrc`, `.editorconfig`,
  `.prettierrc`, `eslint.config.js`, `vitest.workspace.ts`, `.env.example`, `docker-compose.yml`
  (local dev: postgres 16 only), `.github/workflows/ci.yml`.
- `packages/core/**`, `packages/db/**`, `packages/auth/**`.
- You may add a short `README.md` inside each package. Do NOT edit anything under `docs/`,
  `api/`, `CLAUDE.md`, `README.md`, `PROGRESS.md`, or the root `Dockerfile` (another job owns
  `apps/server` and the Dockerfile).

## Stack (fixed)
Node 22, TypeScript 5 strict, ESM only (`"type": "module"`), pnpm workspaces, vitest, eslint
flat config + prettier. Package names `@postbag/core`, `@postbag/db`, `@postbag/auth`.
Drizzle ORM + `postgres` (postgres-js) driver + `drizzle-kit` for migrations. Better Auth with
the `organization` and `apiKey` plugins and the Drizzle adapter. Zod 4 for runtime schemas.
Ajv (draft 2020-12) for JSON Schema validation. Prefer well-known, maintained libraries; no
abandoned packages. Pin major versions in package.json.

## Deliverables

### 1. Workspace
Root scripts: `dev`, `build`, `typecheck`, `test`, `lint`, `format`, `db:generate`,
`db:migrate`, `db:studio`. `tsconfig.base.json` with strict, `moduleResolution: bundler`,
`verbatimModuleSyntax`. CI workflow: pnpm install (cached), lint, typecheck, test — with a
`postgres:16-alpine` service so db tests and migrations run for real.

### 2. `packages/core` — pure domain, zero I/O, exhaustively unit-tested
Export from `src/index.ts`, one module per concern:
- `ids.ts` — `newId(prefix)` producing ids like `fm_8f3kq2x9` (prefix + `_` + 12 chars
  from a URL-safe alphabet without ambiguous chars, crypto-random via `globalThis.crypto`),
  `parseId`, the prefix registry: `org, usr, key, prj, fm, fs, sb, st, ss, src, ds, rt, dl, dg, ev, dr, wh, fl`.
- `submission.ts` — `normalizeBody(input, contentType)`: accepts already-parsed objects from
  urlencoded / multipart (fields only) / JSON; strips control fields (`_redirect`, `_gotcha`,
  `_idempotency`, `_subject`, `_test`) and returns `{ data, control }`; coerces `a[]`/`a[0]`
  style keys into arrays; trims strings; caps depth/size (throws a typed `PayloadTooLarge`).
- `schema.ts` — `validateAgainstSchema(data, jsonSchema)` (Ajv 2020, `allErrors`, no remote
  refs, compiled-schema cache keyed by a stable hash); `detectDrift(data, jsonSchema)` →
  `DriftFinding[]` with kinds `new_field | missing_field | type_change` exactly as in
  DOMAIN-MODEL; `inferSchema(samples: object[])` → JSON Schema + `ui` hints (widget from
  heuristics: email/tel/url/textarea-by-length/number/boolean/date), deterministic.
- `mapping.ts` — `applyMapping(data, mapping, streamSchema)` → `{ payload, extras, problems }`
  supporting `from` (dot-path), `const`, `default`; `expr` throws `ExpressionsNotEnabled`
  (Phase 2, ADR-005) — keep the seam. `validateMapping(mapping, streamSchema, formSchema?)`
  → `{ status: 'valid' | 'incomplete', missing: string[] }`.
- `spam.ts` — `scoreSpam({ data, control, meta, honeypotField })` → `{ score 0..1, reasons[] }`
  using: honeypot filled (score 1), link density, excessive length, disposable-email domains
  (a small built-in list, exported so it can be extended), all-caps ratio, repeated chars.
  Deterministic, documented thresholds.
- `routing.ts` — `planDeliveries({ submission, form, directRoutes, streamMemberships })` →
  array of `{ routeId, destinationId, streamId|null, status: 'pending'|'skipped', skipReason? ,
  schemaVersion }` applying: route `enabled`, form `status` paused, `window`, `quality`
  (spam/quarantined exclusion), and route `mode` (digest routes yield `pending` deliveries
  tagged `digestPeriodKey` computed from `cron`+`timezone` — implement daily/weekly cron
  subset only, document it). Pure function; the caller persists.
- `backoff.ts` — `nextAttemptAt(attempts, now, { base=30s, max=6h, jitterRatio=0.2 }, rng)`
  and `maxAttemptsFor(destinationType)` (email 8, webhook 10, telegram 8, default 8).
- `signing.ts` — `signWebhook(secret, timestamp, body)` → `t=...,v1=<hex>` and
  `verifyWebhookSignature(...)` with constant-time compare and tolerance window, using WebCrypto.
- `template.ts` — tiny, safe Mustache-subset renderer: `{{path.to.value}}`, `{{#if x}}…{{/if}}`,
  `{{#each items}}…{{/each}}`, HTML-escaping on by default with `{{{raw}}}`; no code execution.
- `errors.ts` — `PostbagError` base with `code`, `message`, `hint`, `docs`, `status`; a
  registry of error codes used across the system (at least: `not_found`, `validation_failed`,
  `mapping_incomplete`, `schema_violation`, `payload_too_large`, `rate_limited`,
  `origin_rejected`, `idempotency_conflict`, `plan_limit_reached`, `expressions_not_enabled`).
- `types.ts` — TS types for every entity in DOMAIN-MODEL and every component schema in
  `api/openapi.yaml` (Form, Submission, Stream, Mapping, Destination, Route, Delivery, Event…)
  plus Zod schemas for the *inputs* (FormInput, DestinationInput with the per-type config
  union, RouteInput, StreamInput, StreamSourceInput, SchemaInput, QuickstartInput). Export both.
Tests: vitest, colocated `*.test.ts`, meaningful cases including edge cases; `pnpm --filter
@postbag/core test` must pass; aim for ≥ 85% line coverage on `packages/core`.

### 3. `packages/db` — Drizzle schema + migrations + client
- `src/schema/*.ts`, one file per area: `organizations.ts` (organizations, memberships,
  invitations are owned by Better Auth — see §4 — but *plan*, *timezone*, *limits* columns
  live on a `organization_settings` table keyed by the auth org id), `api_keys` are Better
  Auth's; `projects.ts`, `forms.ts` (forms, form_schemas), `submissions.ts`,
  `streams.ts` (streams, stream_schemas, stream_sources), `destinations.ts`, `routes.ts`,
  `deliveries.ts` (deliveries, digests), `events.ts` (events, drift_events, system_webhooks).
- Every tenant table has `organization_id text not null` + index; every FK between tenant
  tables is paired with a CHECK-by-trigger or composite FK so rows can't cross orgs — pick
  composite FKs `(id, organization_id)` where practical and document the choice.
- Enforce the five invariants in DOMAIN-MODEL §Invariants with unique indexes.
- Columns use the names from DOMAIN-MODEL / openapi (`snake_case` in SQL, camelCase in TS).
  Timestamps `timestamptz`, default `now()`. JSON columns `jsonb`. Public ids are the primary
  keys (text), generated by `@postbag/core` `newId`.
- Delivery claim support: index on `(status, next_attempt_at)`; a helper
  `claimDeliveries(db, { limit, workerId })` using `FOR UPDATE SKIP LOCKED` in a transaction
  that flips rows to `sending` and returns them.
- `LISTEN/NOTIFY` helpers: `notifyDeliveries(db)` and `listenDeliveries(url, onWake)` using a
  dedicated postgres-js connection.
- `createDb(url)` returning `{ db, sql, close }`; `migrate(url)` programmatic runner; generated
  SQL migrations committed under `packages/db/drizzle/`.
- Tests (vitest, run against `DATABASE_URL` or skip with a clear message): migrations apply to
  a fresh db; unique invariants reject duplicates; `claimDeliveries` does not double-claim
  across two concurrent claimers.

### 4. `packages/auth` — Better Auth configuration (no HTTP mounting)
- `createAuth({ db, secret, baseURL, trustedOrigins })` using the Drizzle adapter, email +
  password enabled, `organization` plugin (roles owner/admin/member, invitations), `apiKey`
  plugin (prefix `pb_live_`, hashed at rest, metadata `{ scopes: ('manage'|'read'|'submit')[] }`,
  rate-limit defaults off — we rate-limit ourselves). Session cookies suitable for an SPA on
  the same origin.
- Generate the Better Auth tables with its CLI into `packages/db/src/schema/auth.ts` and make
  sure the migrations include them. Document the regeneration command in the package README.
- Export helpers: `hasScope(key, scope)`, `requireScope`.

### 5. Local dev
`docker-compose.yml` with Postgres 16 on `5433` (avoid clashing with anything on 5432),
`.env.example` with `DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag`,
`BETTER_AUTH_SECRET`, `APP_URL`. Docker is available on this machine; use it to run the db
tests.

## Verification (run all; paste results in your report)
```
pnpm install
pnpm lint
pnpm typecheck
docker compose up -d db && sleep 5
DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag pnpm db:migrate
DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag pnpm test
```
All must pass. Leave the compose db running.

## Report format
A concise report: what you built, deviations from the docs (with reasons), commands run and
their results, the changed-file list, and anything the next job (apps/server) must know.
