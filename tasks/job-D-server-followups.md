# Job D — `apps/server` follow-ups: prod bugs, event dispatch, digests, inference, tooling

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Read `CLAUDE.md`, `PROGRESS.md`,
`docs/ARCHITECTURE.md`, `docs/DOMAIN-MODEL.md`, `docs/AGENT-NATIVE.md`, then the code in
`apps/server/src` and `packages/*/src/index.ts`. Keep `pnpm lint`, `pnpm typecheck`,
`pnpm test` green workspace-wide (`DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag`).

## File boundary
`apps/server/**`, `packages/core/**`, `packages/db/**`, `packages/auth/**`. Do not touch
`docs/`, `api/`, `CLAUDE.md`, `README.md`, `PROGRESS.md`, `apps/web/**`, `packages/sdk/**`.
If `api/openapi.yaml` would need to change, do NOT edit it — describe the needed change in
the report (the generated `/openapi.json` from route definitions is what clients use).

## 1. Bugs found in the production smoke test (fix first, with tests)
a. **Scope implication.** An API key with only `manage` is refused `read`. Define scope
   implication in `@postbag/auth`: `manage ⊇ read ⊇ submit`. `requireScope('read')` must
   accept `manage`. Also make `POST /v1/api-keys` default to `["manage"]` when `scopes`
   is omitted, and echo the *effective* scopes in `/v1/me`.
b. **Email subject renders the slug.** `{{form.name}}` produced `overnight-smoke-test`.
   The template context for every destination must carry `form: { id, name, slug }`,
   `project: { id, name, slug }`, `stream: {...}|null`, `submission: { id, received_at }`,
   `data`, `extras`, `meta`. Default subject `New submission: {{form.name}}`. Test it.

## 2. System webhook dispatch (the `EventDispatcher` seam)
Org-level `system_webhooks` subscribe to event types. On every `events` insert, enqueue a
dispatch for each enabled matching webhook, delivered by the worker with the same HMAC
signing, headers (`Postbag-Event: <type>`), backoff, dead-lettering and health semantics as
route webhooks. Store dispatches in a dedicated `system_webhook_deliveries` table (new
migration; hand-write SQL consistent with the existing style, and update `meta/_journal.json`).
Expose `GET /v1/webhooks/{id}/deliveries` (cursor-paginated). Tests: an event triggers a
signed POST to a local listener; non-matching types don't; failures retry.

## 3. Digest routes
Implement `mode: { type: 'digest', cron, timezone }` for the daily/weekly subset
`@postbag/core` already computes `digestPeriodKey` for. A worker loop runs every minute:
for each digest route whose period has closed, create one `digests` row (unique
`(route_id, period_key)`), mark the period's deliveries as part of it, and send **one**
payload per destination type: email = a clean HTML/text table of the submissions; telegram =
a compact list; webhook = `Postbag-Event: digest.ready` with `{ digest: {...}, submissions: [...] }`.
Empty periods send nothing. Emit `digest.ready`. Tests with a fake clock.

## 4. `observe`-mode schema inference
For forms in `observe` with no schema, a housekeeping loop (every 10 min, and on demand via
`POST /v1/forms/{id}/schema/infer`) calls `@postbag/core` `inferSchema` over the last 200
non-spam submissions and stores the result as an **unpublished draft** returned by
`GET /v1/forms/{id}/schema` with `inferred: true` (already in the contract). Publishing is
still explicit. Once a schema exists, drift detection continues as today.

## 5. Tooling
- Fix `drizzle-kit generate` (`ERR_PACKAGE_PATH_NOT_EXPORTED` resolving `@postbag/core`):
  correct the `exports` map / `types` in `packages/core/package.json` (and db if needed) so
  drizzle-kit's loader can import it; regenerate to confirm it produces **no diff** against
  the hand-written migrations 0000/0001 (if it wants cosmetic changes, prefer adjusting the
  TS schema so the generated SQL matches what is deployed — never rewrite applied migrations).
- Add Postgres RLS as the second fence per ARCHITECTURE.md: enable RLS on every tenant table
  with a policy on `current_setting('app.org_id', true)`; the request path runs
  `SET LOCAL app.org_id` inside a transaction per org-scoped request; the submit path and the
  worker use a role/bypass path. Migration + tests proving a query with the wrong `app.org_id`
  sees nothing. If this proves too invasive for the existing repo layer, implement it behind
  a feature flag `RLS_ENFORCED` defaulting to `false`, fully tested when on, and say so.

## Verification
`pnpm install && pnpm lint && pnpm typecheck && DATABASE_URL=... pnpm test` all green;
`docker build -t postbag:local .` succeeds; run the server locally and demonstrate 1a, 1b, 2
and 4 with curl against it (trimmed transcript in the report). Kill processes you start.

## Report
Built / migrations added / deviations + reasons / verification transcript with test counts /
any change the OpenAPI yaml should get / changed-file list.
