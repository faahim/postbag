# ADR-001 — Node + Hono + Postgres, one Docker image, deployed on Coolify

**Status:** Accepted 2026-08-21

## Context
Postbag must be self-hostable (Principle 7), run the outbox pattern with strong
uniqueness guarantees (Principle 4), and be built quickly by one person plus agents
who already work in TypeScript, Hono, Next.js and Coolify daily.

## Decision
- TypeScript, Node 22 LTS, pnpm workspace.
- **Hono** for the HTTP server (public submit, `/v1`, SPA hosting). Zod schemas
  drive both validation and the generated OpenAPI document (`@hono/zod-openapi`).
- **Postgres 16** as the only stateful service. **Drizzle** for schema and migrations.
- **Better Auth** (organization + API-key plugins) for users, orgs, sessions, keys.
- **Resend** for email. Telegram Bot API direct. Webhooks via `fetch`.
- One Docker image with `api`, `worker`, and `all` entrypoints; `docker-compose.yml`
  for self-host; Coolify for the hosted deployment.

## Alternatives
- **Cloudflare Workers + D1 + Queues.** Excellent edge latency and cost for the
  submit path. Rejected as the *primary* platform: weak self-host story, splits the
  ops model, and D1 lacks the `SKIP LOCKED` / transactional guarantees the outbox
  relies on. `packages/core` stays I/O-free so a Worker-hosted submit edge can be
  added later without rewriting the domain.
- **PocketBase.** Proven in the lead pipeline, but the embedded SQLite and Goja
  hook runtime are exactly the constraints ARCHITECTURE.md in that project warns
  about; multi-tenant SaaS outgrows it.
- **Next.js full-stack.** Fine for the dashboard, wrong for a long-running worker
  and a hot public POST path in one process.

## Consequences
- Everything runs anywhere Postgres runs. The hosted product is the same image.
- We own worker scheduling and backoff (small, tested code) instead of adopting a queue.
