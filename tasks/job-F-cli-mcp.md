# Job F — Agent clients: operationIds, generated contract, `postbag` CLI, `@postbag/mcp`

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list and anything you could not do). Read `CLAUDE.md`,
`docs/PRINCIPLES.md`, `docs/AGENT-NATIVE.md` (§6 is the spec for these clients), `PROGRESS.md`,
then the code named below. Keep `pnpm lint`, `pnpm typecheck`, `pnpm test` green workspace-wide
(`DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag`; `docker compose up -d db`).
Code style: the repo's ESLint is `strictTypeChecked` + `stylisticTypeChecked`, `noUncheckedIndexedAccess`
is on, no `any`, explicit `readonly` on option types, `.js` suffixes on relative imports (ESM).
Licences: `apps/*` and `packages/{core,db,auth}` are AGPL-3.0; `packages/{sdk,cli,mcp}` are MIT
(`LICENSE` already present). **Do not add dependencies** beyond those already in each
`package.json` (they are pre-installed; concurrent `pnpm install` corrupts the lockfile). If you
truly need one, stop and report it.

The job runs as three phases. Phase 1 is one agent; phases 2 and 3 run in parallel afterwards.

---

## Phase 1 — Server: stable operation ids, security scheme, generated contract, legacy redirect

**File boundary:** `apps/server/**`, `api/openapi.yaml` (generated — see 1c), `packages/sdk/**`.
Do not touch `docs/`, `apps/web/**`, `apps/site/**`, `PROGRESS.md`, `README.md`.

### 1a. `operationId` on every route
Every `createRoute({...})` in `apps/server/src/routes/v1/*.ts` (and `health.ts` if it is in the
doc) gets an `operationId`. They are the public, permanent names of operations: MCP tool names
and CLI commands derive from them, so pick once and never rename. Convention: snake_case,
`<resource>_<verb>`, nested resources `<resource>_<sub>_<verb>`. Use exactly these:

| Method + path | operationId |
|---|---|
| GET /v1/me | `me_get` |
| POST /v1/quickstart | `quickstart` |
| GET/POST /v1/api-keys · DELETE /v1/api-keys/{id} | `api_keys_list` · `api_keys_create` · `api_keys_revoke` |
| GET/POST /v1/projects · GET/PATCH/DELETE /v1/projects/{projectId} | `projects_list` · `projects_create` · `projects_get` · `projects_update` · `projects_delete` |
| GET/POST /v1/forms · GET/PATCH/DELETE /v1/forms/{formId} | `forms_list` · `forms_create` · `forms_get` · `forms_update` · `forms_delete` |
| GET /v1/forms/{formId}/embed | `forms_embed` |
| GET/PUT(or POST) /v1/forms/{formId}/schema | `forms_schema_get` · `forms_schema_publish` |
| GET /v1/forms/{formId}/schema/versions | `forms_schema_versions` |
| POST /v1/forms/{formId}/schema/infer | `forms_schema_infer` |
| GET /v1/forms/{formId}/drift | `forms_drift` |
| GET /v1/forms/{formId}/submissions | `forms_submissions_list` |
| GET /v1/submissions · GET /v1/submissions/{submissionId} | `submissions_list` · `submissions_get` |
| GET/POST /v1/streams · GET/PATCH/DELETE /v1/streams/{streamId} | `streams_list` · `streams_create` · `streams_get` · `streams_update` · `streams_delete` |
| GET/PUT /v1/streams/{streamId}/schema | `streams_schema_get` · `streams_schema_publish` |
| GET/POST /v1/streams/{streamId}/sources · DELETE …/sources/{sourceId} | `streams_sources_list` · `streams_sources_add` · `streams_sources_remove` |
| POST /v1/streams/{streamId}/preview | `streams_preview` |
| GET/POST /v1/destinations · GET/PATCH/DELETE /v1/destinations/{destinationId} | `destinations_list` · `destinations_create` · `destinations_get` · `destinations_update` · `destinations_delete` |
| POST /v1/destinations/{destinationId}/test | `destinations_test` |
| GET/POST /v1/routes · GET/PATCH/DELETE /v1/routes/{routeId} | `routes_list` · `routes_create` · `routes_get` · `routes_update` · `routes_delete` |
| GET /v1/deliveries · GET /v1/deliveries/{deliveryId} · POST …/retry | `deliveries_list` · `deliveries_get` · `deliveries_retry` |
| GET /v1/events | `events_list` |
| GET/POST /v1/webhooks · GET/PATCH/DELETE /v1/webhooks/{webhookId} · GET …/deliveries | `webhooks_list` · `webhooks_create` · `webhooks_get` · `webhooks_update` · `webhooks_delete` · `webhooks_deliveries` |

If a route exists that is not in this table, name it by the same convention and list it in your
report. Where the verb differs from the table (e.g. schema publish is `PUT` vs `POST`), keep the
route's method and use the table's id. Add a test in `apps/server/src/routes/v1/apiEndpoints.test.ts`
(or a new `openapi.test.ts`) asserting: every operation in the generated doc has an `operationId`,
all ids are unique, all match `/^[a-z][a-z0-9_]*$/`.

### 1b. Security scheme and descriptions
Register `bearerAuth` (`type: http`, `scheme: bearer`, `bearerFormat: "pb_live_… API key"`) via
`app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", …)` and set
`security: [{ bearerAuth: [] }]` on the document (in `app.doc31` in `apps/server/src/app.ts`).
Mark `/v1/*` operations as requiring it; `GET /health`, `/llms.txt` and the submit path are
public (`security: []`). Make sure every operation has a one-sentence `description` in addition
to `summary` where it adds information an agent needs (what the call is for, what to call next);
keep existing summaries. Every request body schema must carry `.describe()` on fields that are
not self-explanatory (agents read these as tool parameter docs). Use `.openapi({ example })`
where an example helps (ids, emails, cron strings).

### 1c. `api/openapi.yaml` becomes generated
`CLAUDE.md` says the contract will be "generated from Zod route definitions". Do it now:
- Add `apps/server/scripts/export-openapi.ts` that builds the app with a stub DB/env (see how
  `apiEndpoints.test.ts` constructs the app; a real DB must not be required), fetches
  `/openapi.json` via `app.request`, and writes it as YAML to `api/openapi.yaml` with a header
  comment `# Generated by pnpm openapi:export — do not edit by hand.` Use the `yaml` package
  (already installed in `apps/server`). Servers: `https://postbag.dev` and `https://api.postbag.dev`.
- Script `openapi:export` in `apps/server/package.json`; root script `openapi:export`.
- A test (`apps/server/src/openapi.test.ts`) that regenerates the YAML in memory and fails if it
  differs from the committed file (message: "run pnpm openapi:export").
- Regenerate now and commit the result into the working tree. The hand-written YAML had drifted
  (missing `/v1/forms/{id}/schema/infer`, `/v1/webhooks/{id}/deliveries`, `SchemaVersion.inferred`);
  the generated document wins. Report any endpoint that the old YAML had and the code lacks.

### 1d. SDK regenerated from the file, and public
- Change `packages/sdk` `generate` script to `openapi-typescript ../../api/openapi.yaml -o src/schema.d.ts`
  (no running server needed) and regenerate `schema.d.ts`.
- Remove `"private": true`; add `"publishConfig": { "access": "public" }`; make sure `files`,
  `repository`, `homepage`, `license: MIT` are set. Add a short `README.md` (install, `createClient`,
  `submit`, link to https://postbag.dev/docs/api/). Export a typed helper
  `operations` = `paths` keyed by operationId if `openapi-typescript` emits an `operations`
  interface (it does); re-export it from `index.ts`.

### 1e. Legacy host redirect (optional env, self-host friendly)
New optional env `LEGACY_HOSTS` (comma-separated hostnames, default empty) in `apps/server/src/env.ts`.
Middleware registered first in `createApp`: if the request `Host` (or `X-Forwarded-Host`) is in
`LEGACY_HOSTS` **and** the path does not start with `/s/`, `/v1/`, `/health`, respond
`301` to `${APP_URL}${path}${search}`. Submit and API paths on legacy hosts keep working so
old embeds never break. Test: redirect for `/pricing/`, `/app/forms`, `/`; no redirect for
`/s/fm_x`, `/v1/me`, `/health`; no redirect when the host is not listed or the env is empty.
Production sets `LEGACY_HOSTS=postbag.withfaahim.com` (the orchestrator does that, not you).

### 1f. Pre-existing lint failure
`pnpm lint` currently fails on `apps/site/src/pages/docs/[...slug]/index.md.ts` and
`apps/site/src/pages/llms-full.txt.ts` (unresolved `astro:content` types → `no-unsafe-*`). Fix
the root cause in lint configuration only (e.g. make the site's `.astro/types.d.ts` part of the
type program, or add those two generated-type-dependent files to the ESLint `ignores` with a
comment explaining why) — do not rewrite the site files. You may edit `eslint.config.js` for
this item only.

**Acceptance (phase 1):**
- [ ] 59+ operations, each with a unique `operationId` from the table; test enforces it
- [ ] `bearerAuth` in `components.securitySchemes`; `/v1/*` require it
- [ ] `api/openapi.yaml` is generated, committed, and a test keeps it in sync
- [ ] `packages/sdk/src/schema.d.ts` regenerated; `@postbag/sdk` is publishable
- [ ] `LEGACY_HOSTS` redirect with tests
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all green workspace-wide

---

## Phase 2 — `packages/cli` → npm package `postbag` (MIT)

**File boundary:** `packages/cli/**` only. Scaffold exists (`package.json`, tsconfigs, `LICENSE`).
Dependencies available: `commander`, `@postbag/sdk` (workspace). Node ≥ 22, ESM, no bundler;
`bin` is `dist/bin.js` (add the shebang via a tiny `src/bin.ts` that imports and runs `main`).

### Behaviour
- **Config resolution** (first wins): `--api-key` / `--api-url` flags → `POSTBAG_API_KEY` /
  `POSTBAG_API_URL` env → `postbag.json` in cwd (`api_url` only) → `~/.config/postbag/credentials.json`
  (`{ "profiles": { "default": { "api_url", "api_key" } }, "current": "default" }`; respect
  `XDG_CONFIG_HOME`). Default `api_url` = `https://postbag.dev`. Credentials file mode `0600`.
- **Output:** JSON by default when stdout is not a TTY or `--json` is passed (agents); when a TTY,
  print compact human tables (hand-rolled, no deps; tabular alignment, ids first). Every error
  prints `code: message`, then `hint:` and `docs:` lines if present, exit code 1 (`--json` prints
  the raw error object on stderr). Never print the API key.
- **Commands** (use the typed SDK client; no hand-built URLs):
  - `postbag login [--api-key <key>]` — prompts (hidden input) if no key; verifies with `me_get`;
    saves profile; prints org name. `postbag logout`. `postbag whoami` (= `/v1/me`).
  - `postbag init [--name <form name>] [--email <to>] [--telegram <chat id>] [--project <slug>] [--yes]`
    — calls `/v1/quickstart` (interactive prompts for missing name/email unless `--yes`, in which
    case defaults: name = cwd basename, email = the account email from `/v1/me`), writes
    `postbag.json` `{ "form_id", "submit_url", "project", "api_url" }` (merging if it exists),
    prints the HTML embed snippet and the `next` steps from the response. Idempotent: if
    `postbag.json` already has `form_id`, print it and exit 0 unless `--force`.
  - `postbag forms list|get <id>|create --name … [--project …] [--tags a,b]|update <id> …|delete <id>|embed <id>`
  - `postbag submissions list [--form <id>] [--limit n]|get <id>|tail --form <id> [--interval 3]`
    (tail polls `forms_submissions_list` newest-first and prints only unseen ids; Ctrl-C exits 0)
  - `postbag schema get <formId>|publish <formId> --file schema.json|infer <formId>|versions <formId>`
  - `postbag streams list|get|create|delete`, `postbag streams sources add|remove|list`
  - `postbag destinations list|get|create --type email|telegram|webhook --config '{json}'|test <id>|delete <id>`
  - `postbag routes list|get|create --from form:<id>|stream:<id> --to <destinationId> [--mode instant]|delete <id>`
  - `postbag deliveries list [--status failed]|get <id>|retry <id>`
  - `postbag events list [--type …]`, `postbag webhooks list|create --url … --events a,b|delete <id>`
  - `postbag projects list|create --name …`, `postbag api-keys list|create --name … [--scopes manage,read]|revoke <id>`
  - `postbag explain` (prints `GET /llms.txt`), `postbag openapi` (prints `/openapi.json`)
  - `postbag api <METHOD> <path> [--data '{json}']` — generic escape hatch, same auth/output rules.
  For create/update commands accept `--data '{json}'` as the full body alternative to flags.
- `postbag --help` and every subcommand help must be good enough for an agent to use without
  docs: one-line descriptions, examples in the root help. `postbag --version` from package.json.

### Tests (vitest, fake `fetch` injected via the SDK's `fetch` option — see `packages/sdk/src/submit.test.ts`)
- config resolution order; credentials file written with mode 0600; `init` writes `postbag.json`
  and is idempotent; `--json` output shape; error rendering with hint/docs; `api` escape hatch
  builds the right request; `tail` prints only new ids (fake timers).

### README.md
Install (`npm i -g postbag` / `npx postbag init`), the 60-second flow, agent usage
(`POSTBAG_API_KEY=… postbag --json forms list`), `postbag.json` convention from AGENT-NATIVE §7.

**Acceptance (phase 2):**
- [ ] `pnpm --filter postbag build && node packages/cli/dist/bin.js --help` works
- [ ] All commands above exist and route through `@postbag/sdk`
- [ ] Tests green; `pnpm lint && pnpm typecheck` green workspace-wide

---

## Phase 3 — `packages/mcp` → npm package `@postbag/mcp` (MIT)

**File boundary:** `packages/mcp/**` only. Scaffold exists. Dependencies available:
`@modelcontextprotocol/sdk`, `zod`; dev: `yaml`, `@types/node`. Reads `../../api/openapi.yaml`
**only at generation time**; the published package must be self-contained.

### Design
- `scripts/generate.ts` (run with `node --experimental-strip-types`, script `generate`): parses
  `api/openapi.yaml`, dereferences `$ref`s into plain JSON Schema, and writes
  `src/generated/operations.json`: an array of `{ operationId, method, path, summary, description,
  tags, params: [{name, in: "path"|"query", required, schema}], body: JSONSchema|null }`.
  Commit the generated file. A test fails if it is stale (same pattern as the server's openapi test).
- `src/server.ts`: uses the low-level `Server` from `@modelcontextprotocol/sdk/server/index.js` with
  `StdioServerTransport`, so tool `inputSchema` can be raw JSON Schema (no runtime JSON-Schema→Zod).
  - **Tools:** one per operation, `name = operationId`, `description = summary + "\n" + description`,
    `inputSchema` = object merging path params, query params and body properties (body fields
    at top level; if a name collides with a param, prefix the param `path_`/`query_`). Handler
    builds the URL, sends with `Authorization: Bearer`, returns `content: [{ type: "text", text:
    JSON.stringify(json, null, 2) }]`; API errors return `isError: true` with the error object
    (code, message, hint, docs) — never throw.
  - Plus two hand-written tools: `postbag_quickstart` (same as `quickstart` but with a long,
    friendly description that tells the agent this is the one call to make first, and the
    `next` steps it returns) and `postbag_explain` (GET `/llms.txt`, returns the markdown).
  - **Resources:** `postbag://forms` (list), `postbag://forms/{formId}`, `postbag://forms/{formId}/schema`,
    `postbag://streams/{streamId}/schema`, `postbag://openapi` (the doc), `postbag://llms.txt`.
    Implement `resources/list` + `resources/templates/list` + `resources/read`.
  - Config: `POSTBAG_API_KEY` (required; exit with a clear stderr message if missing),
    `POSTBAG_API_URL` (default `https://postbag.dev`); also `--api-key`, `--api-url` argv flags.
- `src/bin.ts` with shebang → `dist/bin.js` (`npx @postbag/mcp`).
- `server.json` at the package root for the MCP registry (`io.github.faahim/postbag`, stdio,
  `npx -y @postbag/mcp`, env `POSTBAG_API_KEY`, `POSTBAG_API_URL`) — follow the current registry
  schema (`https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json` or newer).

### Tests (vitest; connect an in-memory client via `InMemoryTransport` from the SDK; fake `fetch`)
- `tools/list` includes `forms_create` with `name` required and `quickstart`, `postbag_explain`;
- calling `forms_get` with `{ formId }` issues `GET /v1/forms/<id>` with the bearer header;
- calling `forms_create` sends a JSON body; an API error (`{ error: { code, hint } }`) comes back
  as `isError` with the code in the text; `resources/read` of `postbag://llms.txt` works;
- generated file freshness test.

### README.md
Claude Desktop / Claude Code / Cursor config snippets (`npx -y @postbag/mcp` with env), the
tool naming rule ("tool names are the API operation ids"), and the first-call advice
(`postbag_explain`, then `postbag_quickstart`).

**Acceptance (phase 3):**
- [ ] `pnpm --filter @postbag/mcp generate && build`; `POSTBAG_API_KEY=x node dist/bin.js` starts and
      answers `tools/list` over stdio
- [ ] 59+ generated tools + 2 hand-written; resources implemented
- [ ] Tests green; `pnpm lint && pnpm typecheck` green workspace-wide

---

## Not in this job (the orchestrator does these)
Changesets + npm publish workflow, `npm login`, MCP registry publish, site copy flip
(`apps/site/src/pages/for-ai-agents.astro`, `usecases.ts`, `changelog.astro`), `docs/` updates,
`PROGRESS.md`, Coolify env (`LEGACY_HOSTS`).
