# Postbag — Agent Onboarding Contract

You are working in **Postbag**: a form backend that routes. Websites post forms to
it; it stores every submission durably and delivers it to email, Telegram, webhooks,
partners and other systems according to rules. It is multi-tenant, self-hostable,
and **agent-native**: everything a human can do in the dashboard, an agent can do
with an API key.

Read this file, then `docs/PRINCIPLES.md`. Everything else is linked from `docs/README.md`.

## Current state

**Phase 1 — MVP in progress.** `packages/core`, `packages/db`, `packages/auth` and
`apps/server` exist and are verified (lint, typecheck, tests, Docker). Production runs at
`https://postbag.withfaahim.com` (auto-deploys from `main`). **`PROGRESS.md` is the live
blueprint — read it before doing anything**; it records what is done, what is next, every
infrastructure id, and the gotchas.

## The one idea

> **The database makes it correct; events make it fast.**

A submission is a row before it is anything else. Delivery is an outbox drained by a
worker. Never send from a request handler; never rely on an event stream for
correctness. `docs/ARCHITECTURE.md` explains why.

## Golden rules

1. **Never lose a submission.** Spam, violations, over-quota, rate limits ⇒ store with a status. Deletion is only by user action or retention policy.
2. **Contract first.** `api/openapi.yaml` (later: generated from Zod route definitions) is the truth. Dashboard, CLI, MCP and SDK are clients of the same `/v1`. No UI-only capability.
3. **Two personas, one test each** (`PRINCIPLES.md` §1). Anything that taxes the solo dev to serve the operator gets hidden, not removed.
4. **Vocabulary is fixed** (`PRINCIPLES.md` §3). Form, Submission, Stream, Schema, Mapping, Destination, Route, Delivery, Drift. No synonyms in code, docs, or copy.
5. **Schemas are immutable versions.** Never mutate a `form_schemas` / `stream_schemas` row; publish a new version.
6. **Every tenant row has `organization_id`**, and repositories require an org scope. No cross-tenant query ever, including "just for admin".
7. **Self-host parity.** A feature that needs a cloud-only service without a self-host path does not ship.
8. **Agent-native errors.** Every error has `code`, `message`, `hint`, `docs`. Every create returns `next`.
9. **ADRs for arguable decisions.** `docs/decisions/`. Supersede, never edit.
10. Business timezone for digests defaults to the org's setting; ours is `Europe/Stockholm`.
11. **Beautiful by default.** Any task touching `apps/web` or the marketing site invokes the `make-interfaces-feel-better` and `transitions-dev` skills (plus `design-taste-frontend` / `frontend-design` for new screens) *before* writing UI code, and follows `docs/DESIGN.md`. Hardcoded colour classes are lint errors; motion uses tokens; every list has a designed empty state.

## Repo map

```
packages/core      pure domain — validation, mapping, routing, spam, templates (no I/O)
packages/db        Drizzle schema, migrations, repositories
apps/server        Hono: /s/{id} submit, /v1 API, auth, worker entrypoints, serves the SPA
apps/web           Vite + React dashboard (ADR-003, proposed)
packages/sdk       generated TypeScript client
packages/cli       `postbag` CLI
packages/mcp       MCP server
api/openapi.yaml   the contract
docs/              start at docs/README.md
```

## Related projects (context, not dependencies)

- `~/Developer/vendingmachine-stuff` — the lead pipeline Postbag generalises. Its `docs/ARCHITECTURE.md` is the ancestor of ours. **Business-critical and live**; Postbag replaces it only after shadow-mode parity (ROADMAP Phase 2).
- `~/Developer/smedja` — WordPress site factory; will provision a `managed` Postbag form per forged site.
- `~/Developer/dekhval-erp` — ERP/CRM; consumes Postbag via system webhooks first, native destination later.

## How to do common things

- **Change the model:** edit `docs/DOMAIN-MODEL.md` *and* `api/openapi.yaml` in the same change. If arguable, add an ADR.
- **Propose a new destination type:** add a row to the Destination table in `DOMAIN-MODEL.md`; implementation follows the `DestinationAdapter` interface in `ARCHITECTURE.md`.
- **Add vocabulary:** you almost certainly shouldn't. If you must, `PRINCIPLES.md` §3 first.
