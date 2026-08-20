# Job B — `apps/server`: submit path, outbox worker, `/v1` API, auth, Dockerfile

You are implementing the HTTP + worker service of **Postbag** at
`/Users/faahim/Developer/postbag` (branch `main`; do NOT run git commands; leave changes in
the working tree and finish with the changed-file list).

Job A already delivered `packages/core` (pure domain), `packages/db` (Drizzle schema,
migrations, `claimDeliveries`, LISTEN/NOTIFY helpers) and `packages/auth` (Better Auth
config). **Use them; do not duplicate their logic.** Read their `src/index.ts` and READMEs
to learn the actual exports — they are the truth over anything this spec assumes.

## Read first
1. `CLAUDE.md`, `docs/PRINCIPLES.md` (§4 never lose a submission, §5 contract first, §8 agent-native errors).
2. `docs/ARCHITECTURE.md` — *The submit path*, *The worker*, *Destination adapters*, *Webhook contract*, *Multi-tenancy*, *Auth*, *Observability*. Implement it as written.
3. `docs/AGENT-NATIVE.md` — `/v1/me`, `/v1/quickstart`, `_test` submissions, error envelope, `next[]`.
4. `api/openapi.yaml` — the contract for every route. Paths, params, bodies, responses, status codes.
5. `packages/core/src/index.ts`, `packages/db/src/index.ts`, `packages/db/README.md`, `packages/auth/src/index.ts`, `packages/auth/README.md`.
6. `PROGRESS.md` — the deployment environment (env var names the container receives).

## File boundary
- `apps/server/**` (new), root `Dockerfile` (replace the placeholder), `.dockerignore`,
  root `package.json` scripts only if needed to add `dev:server` / `build` wiring,
  `docker-compose.yml` may gain an optional `server` service.
- You may add small, clearly-needed exports to `packages/core` / `packages/db` / `packages/auth`
  if something is genuinely missing — list every such change in your report. Do not restructure them.
- Do NOT touch `docs/`, `api/`, `CLAUDE.md`, `README.md`, `PROGRESS.md`, `apps/web` (another job).

## Stack (fixed)
Hono 4 on `@hono/node-server`, `@hono/zod-openapi` for `/v1` so `GET /openapi.json` is
**generated from the route definitions** (Principle 5). Zod from `@postbag/core` input schemas.
Pino for structured JSON logs (fields `org_id`, `form_id`, `submission_id`, `delivery_id`,
`request_id` whenever known). Resend SDK for email. Native `fetch` for Telegram + webhooks.
Vitest; tests hit the app via `app.request()` and a real Postgres (`DATABASE_URL`, local compose
db on 5433 from Job A).

## Deliverables

### 1. Process model
`apps/server/src/main.ts` reads `POSTBAG_ROLE` = `api` | `worker` | `all` (default `all`) and
`PORT` (default 3000). `MIGRATE_ON_BOOT` (default `true`) runs `@postbag/db` migrations before
listening. Graceful shutdown on SIGTERM (stop accepting, finish in-flight deliveries, close db).

### 2. Auth + tenancy
- Mount Better Auth from `@postbag/auth` at `/api/auth/*`.
- On user signup (Better Auth database hook), create a personal organization, make the user
  `owner`, create `organization_settings` (plan `free`, timezone `UTC`) and a `Default` project.
- Middleware `requireOrg` resolves **either** a session cookie (active organization from Better
  Auth's organization plugin; fall back to the user's first org) **or** `Authorization: Bearer
  pb_live_…` via the apiKey plugin, producing `c.var.scope = { organizationId, actor, scopes }`.
  API keys carry `organizationId` + `scopes` in their metadata. `requireScope('manage'|'read'|'submit')`.
- `POST /v1/api-keys` (session only): create a key for the active org with scopes; returns the
  raw key once. `GET /v1/api-keys`, `DELETE /v1/api-keys/{id}`.
- Every repository/query takes the org id from `c.var.scope`; a 404 is returned for rows in
  other orgs (never 403 — indistinguishable by design).

### 3. Public submit path — exactly as ARCHITECTURE.md §"The submit path"
`POST /s/{formId}` + `OPTIONS /s/{formId}` + `GET /s/{formId}/schema`.
- Parse urlencoded, multipart (text fields only; files → 415 with a hint "Phase 2"), JSON.
  Body cap 256 KB (413 with `payload_too_large`).
- Use `@postbag/core` `normalizeBody`, `scoreSpam`, `validateAgainstSchema`, `detectDrift`,
  `planDeliveries`. Honeypot / origin / rate-limit (in-memory token bucket per form+ip; fine
  for one instance) / schema outcomes **store the submission with a status** — never reject.
- One transaction: insert submission, drift events if any, deliveries (with `payload` snapshot
  already mapped via `applyMapping` for stream routes; identity for direct), `submission.received`
  event. Then `notifyDeliveries`.
- Respond per openapi: JSON → `{ ok, submission_id, status, deliveries? (when _test) }`;
  HTML form post (`Accept: text/html` or urlencoded without JSON accept) → `303` to `_redirect`
  → `settings.redirect_url` → a tiny hosted thanks page at `/s/{formId}/thanks`.
- `_test: true` marks `submissions.test = true`; test submissions are excluded from counts.
- CORS: `allowed_origins` empty ⇒ `*`; else exact match; `Vary: Origin`.
- Paused forms: store, no deliveries, respond normally.
- Idempotency: `Idempotency-Key` header or `_idempotency` field; duplicate ⇒ return the
  original submission id with `200` and `idempotent: true`.

### 4. Management API `/v1` — implement every path in `api/openapi.yaml`
Projects, forms (+`/embed`, `/schema`, `/schema/versions`, `/drift`, `/submissions`),
submissions (get/patch/delete/search), streams (+`/schema`, `/sources`, `/sources/{id}`,
`/preview`), destinations (+`/test`), routes, deliveries (+`/retry`), events, system webhooks
(CRUD only; dispatch is a later job — leave a TODO and an `EventDispatcher` seam),
`/v1/me`, `/v1/quickstart`, `/llms.txt`, `/openapi.json`, `/health`.
- Cursor pagination: opaque base64 of `(created_at, id)`; `limit` ≤ 200.
- `if_exists: "return"` on project/form/stream creation; `Idempotency-Key` on all POSTs
  (store `(org, key) → response` for 24 h in a small table or in-memory LRU — table preferred).
- Errors: always `{ error: { code, message, hint, docs } }`; `docs` =
  `https://postbag.withfaahim.com/docs/errors/{code}` for now. Zod validation failures map to
  `validation_failed` with `details`.
- Creates return `next[]` suggestions (at least for forms, destinations, streams) and form
  creates/`/embed` return rendered snippets for `html`, `fetch`, `react`, `astro`,
  `nextjs_action` — render from the current schema's `ui` hints when present, else a sensible
  `email` + `message` default. `submit_url` uses `APP_URL`.
- `/v1/quickstart` exactly per `docs/AGENT-NATIVE.md` §2 (idempotent by project+name).
- `/v1/forms/{id}/schema` publish: new immutable version; bump `current_schema_version`;
  `form.schema.changed` event; resolve open drift events whose field now matches; re-validate
  stream source mappings (`mapping_status`).
- `/v1/streams/{id}/sources` attach: run `validateMapping`; incomplete ⇒ 422
  `mapping_incomplete` with `missing[]`, nothing written.
- `/v1/destinations/{id}/test`: run the adapter with a sample payload, return `DeliveryResult`.
- `/v1/deliveries/{id}/retry`: re-snapshot payload with current mapping, set `pending`, notify.
- `/llms.txt`: markdown generated at boot from a template in `apps/server/src/llms.md` —
  what Postbag is, the vocabulary, the three calls that matter (`/v1/me`, `/v1/quickstart`,
  `POST /s/{id}`), links to `/openapi.json`. Keep it under 200 lines and accurate.
- `/health`: `{ ok, db: 'up'|'down', worker: { heartbeat_at, alive }, oldest_pending_delivery_s, version }`;
  non-200 when db is down. Worker heartbeat lives in a `worker_heartbeats` row (add to db if missing).
- Serve a static SPA from `apps/server/public` at `/app/*` with history fallback **if the
  directory exists**; otherwise `/app` returns a one-line placeholder page. Root `/` redirects
  to `/app`. (Job C builds the SPA into that directory.)

### 5. Worker — ARCHITECTURE.md §"The worker"
- Claim loop via `@postbag/db` `claimDeliveries`, concurrency 5, wakes on `listenDeliveries`
  and every 15 s. Heartbeat every 10 s.
- Adapter interface exactly as in ARCHITECTURE.md. Implement `email` (Resend; `MAIL_FROM` env,
  default `Postbag <postbag@updates.withfaahim.com>`; `Reply-To` from `reply_to_field` or the
  first email-looking field; subject via `@postbag/core` template; an HTML + text body that
  lists fields cleanly), `telegram` (Bot API `sendMessage`, HTML parse mode, template default
  lists fields), `webhook` (JSON POST, `Postbag-Signature` via `signWebhook`, `Postbag-Delivery`,
  `Postbag-Event` headers, 10 s timeout, body per ARCHITECTURE.md; 2xx sent, 410 ⇒ disable
  destination + `dead`, else retry).
- Backoff via `@postbag/core` `nextAttemptAt`; `dead` after `maxAttemptsFor(type)`; `dead` ⇒
  `delivery.dead` event + error log; consecutive failures ≥ 5 ⇒ destination `health = failing`
  + `destination.failing` event; success resets to `ok` (+ `destination.recovered`).
- Digest-mode routes: out of scope — leave deliveries for digest routes `pending` with a
  `digestPeriodKey` and a TODO; do not send them.

### 6. Dockerfile + compose
Multi-stage, multi-arch base (`node:22-alpine`), pnpm via corepack, `pnpm fetch`/install with
workspace pruning (`pnpm deploy` or equivalent) so the runtime image is small; copies
`packages/db/drizzle` migrations; `ENV POSTBAG_ROLE=all PORT=3000`; `EXPOSE 3000`;
`HEALTHCHECK` hitting `/health`; runs as non-root. `.dockerignore` excludes node_modules,
.git, docs. The image must build on arm64 and amd64.

### 7. Tests (vitest, real Postgres)
Cover at minimum: submit stores + routes + responds for JSON and urlencoded; honeypot ⇒
`spam` and still stored; paused form stores without deliveries; idempotent re-submit;
CORS headers; API key auth happy/sad paths; org isolation (404 across orgs); quickstart
idempotency; schema publish bumps version + resolves drift; stream attach with incomplete
mapping ⇒ 422; worker delivers a webhook to a local `http.createServer` listener with a valid
signature, retries on 500 and goes `dead` at the max, disables on 410; `/health` shape.

## Verification (run all; paste results)
```
pnpm install && pnpm lint && pnpm typecheck
DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag pnpm test
DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag BETTER_AUTH_SECRET=devsecretdevsecretdevsecret APP_URL=http://localhost:3000 pnpm --filter @postbag/server dev &
# then, against the running server:
curl -s localhost:3000/health
curl -s localhost:3000/llms.txt | head -20
curl -s localhost:3000/openapi.json | head -c 300
# sign up via /api/auth/sign-up/email, create an API key via /v1/api-keys with the session cookie,
# run /v1/quickstart with the key, POST a JSON + a urlencoded submission to the returned submit_url,
# GET the submission and its deliveries (webhook destination pointed at a local listener must show `sent`).
docker build -t postbag:local .   # must succeed
docker run --rm -e DATABASE_URL=postgres://postbag:postbag@host.docker.internal:5433/postbag -e BETTER_AUTH_SECRET=devsecretdevsecretdevsecret -e APP_URL=http://localhost:3000 -p 3000:3000 postbag:local  # /health must be 200
```
Kill background processes you started before finishing.

## Report
What you built; any additions to packages/*; deviations + reasons; the verification transcript
(trimmed); env vars the container needs (complete list with defaults); changed-file list.
