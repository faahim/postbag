# ADR-004 — Form schema and stream schema are separate, versioned contracts

**Status:** Accepted 2026-08-21

## Context
The vending fleet has 15+ forms collecting similar data with different labels and
extra fields. Today the normalisation lives in hand-maintained code and drifts
silently. The platform must be the source of truth so that a form change is seen
in one place and downstream contracts do not move by accident.

## Decision
Two schema objects, both versioned and immutable:
- **FormSchema** (inbound, per form) with modes `observe | enforce | managed`.
- **StreamSchema** (outbound, per stream) — what every route on the stream delivers.
A **Mapping** per (stream, form) connects them and is validated at attach time.
Submissions and deliveries record the schema version they conform to. Schema
changes emit events that system webhooks can subscribe to. Drift is detected
against the form schema and surfaced; it never alters the stream contract.

## Alternatives
- **One schema per form, partner receives raw fields.** What exists today; the
  problem statement.
- **Schemaless everywhere + transforms in code.** Fast to start, recreates the
  drift problem inside Postbag.
- **Stream schema only, forms must match it exactly.** Kills the solo-dev path and
  can't absorb legitimate per-site extra fields.

## Consequences
- Four extra tables and an attach-time validation step in Phase 1.
- The `observe` default keeps the solo-dev path schema-free (Principle 2).
