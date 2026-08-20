# @postbag/db

The only Postbag package that talks to PostgreSQL. Tenant foreign keys use composite
`(id, organization_id)` references so the database rejects cross-organization rows.

Generate migrations after schema changes with `pnpm db:generate` at the repository root.
Apply committed migrations with `pnpm db:migrate`.
