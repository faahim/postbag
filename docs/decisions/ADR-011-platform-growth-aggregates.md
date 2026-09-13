# ADR-011 — Enumerated platform growth aggregates

**Status:** Accepted 2026-09-14

## Context

Postbag's tenant boundary requires every tenant-row query to carry an Organization
scope, including administrative work. The hosted operator also needs a small set of
current growth signals without exporting customer data or
opening tenant workspaces.

A general platform-admin bypass, a cross-tenant list endpoint, or arbitrary reporting
queries would weaken the boundary. A fixed aggregate report can answer the current
business questions without returning a tenant row or identifier.

## Decision

`GET /v1/admin/growth-metrics` is the sole exception to organization-scoped reads. It
may perform only the following platform-wide aggregates:

- Organization totals by creation window and plan;
- Form totals by creation window, plus Forms with a real Submission in 30 days;
- Submission totals by receipt window and test status;
- the number of Organizations with a sent Delivery for a real Submission in 30 days;
- retained anonymous sandbox totals for creation, claim and current expired/blocked
  state in the 30-day window; and
- Destination totals grouped by Destination type.

The implementation may use `COUNT` and `COUNT(DISTINCT)` and may group only by the
closed plan and Destination-type enums. Tenant ids may be used inside a distinct
count or same-tenant join, but no tenant id, email, name, payload, API key, individual
row, per-Organization result, or caller-selected grouping/filter is returned. Every
metric counts rows currently retained in the primary database. Retention and explicit
deletion can therefore reduce totals and window counts. Sandbox values are not a
historical creation, claim, or conversion funnel: housekeeping deletes every sandbox
after `expires_at`, including claimed rows.

The route first applies the existing `PLATFORM_ADMIN_EMAILS` allowlist. A caller who
is not allowlisted receives `404 not_found`, preserving endpoint concealment. An
allowlisted API key must also carry `read`; the scope check runs before aggregate
queries. Sessions already carry that scope. An unset allowlist keeps the endpoint
inaccessible on self-hosted installations.

This exception does not change tenant repositories, row-level security, or any
mutation path, and grants no general platform-admin access to tenant data. Adding a
source table, metric, grouping dimension, filter, tenant-level result, or second
cross-tenant endpoint requires a superseding ADR.

## Alternatives

- **Query each Organization through its repository.** This disguises the same
  cross-tenant operation as a loop, costs more, and creates pressure to retain rows.
  Rejected.
- **Maintain a separate analytics pipeline.** Appropriate if reporting becomes broad
  or historical, but unnecessary infrastructure for this fixed report. Rejected for
  the current scope.
- **Give platform admins unrestricted tenant access.** This would make administration
  convenient at the cost of the central isolation guarantee. Rejected.

## Consequences

- Growth decisions can use one small current-state API response without exposing a
  customer list. Historical funnel reporting remains out of scope.
- Tests must prove non-admin concealment, `read`-scope enforcement before metric
  loading, aggregate-only response shape and counting across more than one Organization.
- Any reporting expansion is a deliberate architecture decision rather than an
  incidental unscoped query.
