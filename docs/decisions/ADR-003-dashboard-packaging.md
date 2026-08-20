# ADR-003 — Dashboard is a Vite + React SPA served by the API container

**Status:** Proposed — decide before Phase 1 UI work starts

## Context
Self-host should be one container + Postgres. Fahim's existing dashboards (Dekhval,
Smedja) are Next.js and he is fluent in it.

## Decision (proposed)
Build the dashboard as a Vite + React SPA (`apps/web`), compiled into
`apps/server`'s static directory at image build, served under `/app` with cookie
auth against the same `/v1` API everyone else uses. This keeps the "one image"
promise and enforces Principle 5 (the UI is just another API client).

Component system is shadcn/ui regardless of this decision — see `docs/DESIGN.md`.

## Alternatives
- **Next.js app as a second container.** Familiar, SSR available, but doubles the
  self-host footprint and tempts server-only code paths that bypass `/v1`.
- **Hono JSX / HTMX server-rendered.** Simplest runtime; weaker for the live
  submissions inbox and the mapping editor.

## Consequences
- No SSR; the dashboard is behind login anyway. Marketing/docs site is separate
  (Astro) and can be SSR/SSG freely.
- One more build step in the Dockerfile.
