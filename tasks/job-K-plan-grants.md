# Job K — Plan source + complimentary access (grant codes), without breaking the paid flow

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Read `CLAUDE.md` (golden rules 1, 2, 6, 8),
`docs/PRINCIPLES.md`, `docs/DOMAIN-MODEL.md` (Organization: plan + limits), `docs/ARCHITECTURE.md`
(plan limits, soft-fail), `docs/decisions/ADR-006-license-and-business-model.md`,
`ADR-007-billing-provider.md`, `PROGRESS.md`, then `apps/server/src/lib/plan.ts`,
`packages/db/src/schema/organizations.ts`, `packages/db/drizzle/` (migration style + `meta/_journal.json`),
`apps/server/src/routes/v1/me.ts`, `apps/server/src/routes/v1/apiKeys.ts` (route + test patterns),
`apps/server/src/middleware/requireOrg.ts`, `apps/web/src/routes/_app/settings/index.tsx`,
`packages/cli/src/commands/*.ts`. Keep `pnpm lint`, `pnpm typecheck`,
`DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag pnpm test` green. No new deps. Before
UI, invoke `make-interfaces-feel-better` and `transitions-dev` and follow `docs/DESIGN.md`. Regenerate
`api/openapi.yaml` (`pnpm openapi:export`) and the SDK (`pnpm --filter @postbag/sdk generate && build`)
and the MCP operations (`pnpm --filter @postbag/mcp generate`) — never hand-edit them.
**Another agent is editing `apps/site/**` right now — do not touch it.**

## The problem
Fahim wants (a) his own account and a few friends' accounts to have Pro/Team limits without paying,
(b) a structure that cannot be confused with, or break, the real paid flow when Polar billing
lands (Phase 3), and (c) nothing that violates golden rule 6 (no cross-tenant queries, "not even
for admin").

## The design
**Separate *what tier* from *why*.** `organizations.plan` keeps meaning the tier (`free|pro|team|
selfhost`, limits from `plan.ts`). Add:

- `organizations.plan_source` — `'free' | 'billing' | 'complimentary' | 'selfhost'`, default `'free'`.
  `billing` is written only by the (future) Polar webhook handler; `complimentary` only by
  redeeming a grant code; `selfhost` by the self-host bootstrap. Billing code must never
  downgrade a `complimentary` org and must refuse to start checkout for one (return
  `409 plan_is_complimentary` with a hint) — write that rule as a helper now
  (`canStartCheckout(org)`), even though checkout doesn't exist yet, and test it.
- `organizations.plan_expires_at` (nullable) — for time-boxed grants; a housekeeping tick (reuse the
  existing housekeeping loop) reverts expired complimentary orgs to `free`/`free` and emits
  `organization.plan.changed`.
- `organizations.plan_note` (nullable, short text, shown to the org: "Courtesy of Postbag").

**Grant codes, not admin writes into other tenants.** New table `plan_grants`:
`id (pg_… prefix, add to packages/core ids)`, `code` (unique, 16+ chars, URL-safe, stored hashed
like API keys — show once), `plan`, `note`, `expires_at` (of the grant itself), `max_redemptions`
(default 1), `redeemed_count`, `created_by_user_id`, `created_at`, `revoked_at`. Redemptions are
recorded in `plan_grant_redemptions (grant_id, organization_id, redeemed_at)`.

- **Minting** a code is a platform-admin action that touches no tenant: `POST /v1/admin/plan-grants`
  (`operationId: admin_plan_grants_create`, tag `admin`) — allowed only when the **session user's
  email** is in env `PLATFORM_ADMIN_EMAILS` (comma-separated, default empty ⇒ endpoint returns
  `404 not_found`, so self-hosters without the env never see it). Session-only, like `POST
  /v1/api-keys` — API keys cannot mint. Also `GET /v1/admin/plan-grants` (list, hashed codes never
  returned) and `POST /v1/admin/plan-grants/{id}/revoke`. No endpoint lists or modifies other
  organizations.
- **Redeeming** is org-scoped, done by the org's own owner: `POST /v1/plan/redeem` body `{ code }`
  (`operationId: plan_redeem`), requires `manage` scope or session owner. Effects: sets `plan`,
  `plan_source='complimentary'`, `plan_note`, `plan_expires_at` (from the grant's `plan_duration_days`
  if set), increments `redeemed_count`, writes a redemption row, emits `organization.plan.changed`
  with before/after. Errors: `404 grant_not_found`, `410 grant_expired`/`grant_revoked`/`grant_exhausted`,
  `409 plan_is_billing` (a paying org can't redeem; hint: cancel the subscription first).
  Redeeming a lower tier than current is refused (`409 plan_not_upgrade`).
- `/v1/me` gains `plan_source`, `plan_expires_at`, `plan_note` next to `plan` and limits.

**Testing the paid flow later stays clean:** paid-flow tests will use Polar's sandbox + a 100 %
discount, producing `plan_source='billing'`. Complimentary orgs are orthogonal and excluded from any
billing sync by the `plan_source` check — add that rule to `docs/`? No — `docs/` is out of your
boundary; put the rule in code comments + the ADR-007 consequences are already compatible.

## UI and CLI
- Dashboard Settings → **Plan** card (new, above API keys or where plan info fits): current tier with
  limits (from `/v1/me`), a quiet source line ("Free" / "Complimentary · Courtesy of Postbag · until
  {date}" / "Billed through Polar" — the last one can't happen yet), and **"Have a code?"** → an
  inline input + Redeem button with the standard success/error transitions; on success the card
  updates in place (invalidate the `me` query) with a short accent "It arrived"-style moment.
- Admin surface: **no dashboard UI** for minting in this job (keep it API/CLI): `postbag admin
  plan-grants create --plan pro --note "friend" [--days 365] [--uses 1]` and `list`, `revoke` in the
  CLI — these need a session, so the CLI command explains that it must run with a browser session
  cookie? No: simpler — make the admin endpoints accept an API key **whose org owner's email is in
  `PLATFORM_ADMIN_EMAILS`** (the key's org → owner member → user email). That keeps "session-only"
  out of it and lets the CLI/MCP work. Document in the route description.
- CLI: `postbag plan` (show) and `postbag plan redeem <code>`.

## Tests
Schema migration applies cleanly on the test DB (hand-written SQL in the existing style + journal
entry; **never mutate existing migrations**). Route tests: mint (admin email vs not → 404), redeem
happy path updates org + writes event, each error code, expiry housekeeping reverts, `canStartCheckout`
rules, `/v1/me` shape. OpenAPI test picks up the new operations with correct security.

## Acceptance
- [ ] Migration adds `plan_source`, `plan_expires_at`, `plan_note`, `plan_grants`, `plan_grant_redemptions`
- [ ] Admin mint/list/revoke gated by `PLATFORM_ADMIN_EMAILS`; org-scoped redeem; events emitted
- [ ] `/v1/me` exposes plan source; Settings → Plan card with redeem; CLI `plan`, `plan redeem`, `admin plan-grants`
- [ ] Expiry housekeeping; `canStartCheckout` helper with tests
- [ ] `pnpm lint && pnpm typecheck && pnpm test` green; contract + SDK + MCP regenerated
