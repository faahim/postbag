# Architecture Decision Records

One decision per file, numbered, never edited after acceptance — write a new ADR
that supersedes it. Template: Context → Decision → Alternatives → Consequences.

| #                                                    | Decision                                                                       | Status                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| [001](./ADR-001-stack.md)                            | Node + Hono + Postgres on Coolify, one image                                   | Accepted 2026-08-21          |
| [002](./ADR-002-outbox-as-queue.md)                  | The Postgres outbox is the delivery queue                                      | Accepted 2026-08-21          |
| [003](./ADR-003-dashboard-packaging.md)              | Dashboard is a Vite SPA served by the API container                            | Proposed                     |
| [004](./ADR-004-two-schema-layers.md)                | Form schema and stream schema are separate, versioned contracts                | Accepted 2026-08-21          |
| [005](./ADR-005-expression-language.md)              | Expression language for mappings, filters, transforms                          | Proposed (JSONata)           |
| [006](./ADR-006-license-and-business-model.md)       | Open source: AGPL-3.0 server, MIT clients; hosted plans differ only in limits  | Accepted 2026-08-21          |
| [007](./ADR-007-billing-provider.md)                 | Billing through a Merchant of Record (Polar; Paddle fallback), not Stripe      | Accepted 2026-08-21          |
| [008](./ADR-008-anonymous-claimable-quickstart.md)   | Anonymous sandbox Forms can be tested, then claimed by a person                | Accepted and live 2026-08-23 |
| [009](./ADR-009-anonymous-admission-boundary.md)     | Anonymous admission is bounded before the durable Submission contract begins   | Accepted 2026-08-23          |
| [010](./ADR-010-attachment-storage-and-admission.md) | Attachments use private S3-compatible storage and a durable admission boundary | Accepted 2026-08-30          |
