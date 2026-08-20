# Architecture Decision Records

One decision per file, numbered, never edited after acceptance — write a new ADR
that supersedes it. Template: Context → Decision → Alternatives → Consequences.

| # | Decision | Status |
|---|---|---|
| [001](./ADR-001-stack.md) | Node + Hono + Postgres on Coolify, one image | Accepted 2026-08-21 |
| [002](./ADR-002-outbox-as-queue.md) | The Postgres outbox is the delivery queue | Accepted 2026-08-21 |
| [003](./ADR-003-dashboard-packaging.md) | Dashboard is a Vite SPA served by the API container | Proposed |
| [004](./ADR-004-two-schema-layers.md) | Form schema and stream schema are separate, versioned contracts | Accepted 2026-08-21 |
| [005](./ADR-005-expression-language.md) | Expression language for mappings, filters, transforms | Proposed (JSONata) |
