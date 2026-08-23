# Anonymous, claimable quickstart — lean implementation plan

Implements [`ADR-008`](../docs/decisions/ADR-008-anonymous-claimable-quickstart.md).
Read `docs/PRINCIPLES.md`, `docs/ARCHITECTURE.md`, `docs/AGENT-NATIVE.md` and
`PROGRESS.md` first. Preserve the existing authenticated `/v1/quickstart`; this adds a
smaller public path for an agent that has no credentials yet.

## Outcome

An agent can create a temporary Form, wire its stable submit URL into a site, store and
verify a few test Submissions, then hand ownership to its user without a manual signup:

1. The agent creates the anonymous Form and keeps its sandbox token.
2. When the user is ready, the agent requests a six-digit code for their email.
3. The user gives the code to the agent.
4. The existing email-code flow creates or resolves the account and returns a manage API key.
5. The agent claims the Form with that key and the sandbox token.

The user may instead claim in the browser after Google or GitHub sign-in. New hosted
email/password signup is disabled server-side, while password sign-in remains available
for existing users. Self-hosted instances may keep email/password signup when social
providers are unavailable. Email OTP remains an intentional, rate-limited agent flow.

## Security invariants

- Anonymous resources cannot create Destinations, Routes, Deliveries, Events or outbound traffic.
- A rejected anonymous request is not accepted: once a hard allowance is exhausted, return a
  typed error without storing it. Every accepted Submission is durable.
- The submit URL stays `/s/{formId}` before and after claim.
- Claiming requires both possession of the sandbox token and an authenticated organization.
- A supplied `claim_email` additionally requires the verified claimant email to match.
- Pre-claim Submissions become `test=true`; they never deliver retroactively and retain their
  original 24-hour deletion time.
- Expiry is checked on every operation; housekeeping is cleanup, not the security boundary.
- Sandbox tokens, idempotency keys, email addresses and OTPs never appear in logs.
- Record in a short follow-up decision that anonymous capacity is an admission boundary:
  rejected requests were never accepted, while every accepted Submission remains durable.

## Minimal data model

Add two non-tenant staging tables. They are outside organization RLS and are reachable only
through narrow public/claim repository functions.

### `anonymous_sandboxes`

- `id` — Form-compatible public id
- `name`, claim-ready `slug`, optional `allowed_origin`
- optional keyed hash of normalized `claim_email`
- hash of one random sandbox token used for read and, with authentication, claim
- encrypted token replay value, deleted with the sandbox after at most 24 hours
- `status` — `active | claimed | expired | blocked`
- `expires_at` and accepted Submission count
- creation idempotency-key hash, request-body hash and abuse-source key
- nullable claimed organization/user/time

### `anonymous_submissions`

- Submission-compatible `id`, `sandbox_id`, bounded JSON `data`, minimal metadata
- optional idempotency key and `received_at`
- cascade-delete with the sandbox

Do not create a temporary organization or put anonymous rows in normal tenant tables.

## API contract

### `POST /v1/public/sandboxes` — unauthenticated

Input: `name`, optional `origin`, optional `claim_email`. Require a canonical UUIDv4
`Idempotency-Key`, generated with a CSPRNG and treated as a secret. Return the stable submit URL,
snippets, expiry, sandbox-token verification instructions, a claim URL and literal `next` calls.
Never accept Destination details,
redirect URLs or arbitrary Form settings here. Return `Cache-Control: no-store`.

Generate the sandbox id and token with a CSPRNG. Store the token hash for authorization and an
encrypted copy only for replaying the same successful response during the sandbox's 24-hour life.
Require the request-body hash to match on replay; a reused key with a different body is a conflict.
Put the browser token in `/app/claim#token=...`; the SPA removes the fragment and POSTs it, so it
never enters query strings, server logs or referrers.

### `POST /s/{formId}` — existing public route

Resolve a normal Form first, otherwise a sandbox. The sandbox branch reuses bounded body parsing
but performs no schema inference or routing. In one transaction, conditionally increment
`accepted_count` only where the sandbox is active, unexpired and below five, then insert the
anonymous Submission. If the update returns no row, re-resolve the id as a normal Form before
returning an error: claim may have won the race. Expiry returns `410 sandbox_expired`; a full
sandbox returns `409 sandbox_limit_reached`. Rejected attempts insert no row.

### `GET /v1/public/sandboxes/{id}` — token capability

Require the sandbox token in a dedicated authorization scheme, not API-key `Bearer` and never in
the URL. Return status, expiry, remaining allowance and all accepted Submissions; the result is
strictly bounded to five. The token alone cannot claim.

### `POST /v1/sandboxes/{id}/claim` — authenticated

Accept a browser session or a manage-scoped API key plus the sandbox token. For keys minted by
the email-code flow, retain the creating user id in API-key metadata so an email-bound claim can
resolve and compare the verified user email. Make the operation idempotent.

The claim transaction locks the sandbox, checks expiry/token/email/target Form capacity, resolves
or creates the organization's Default Project, de-duplicates the Form slug under its unique
organization/project constraint, creates the real Form with the same id, copies anonymous
Submissions as tests, emits `form.created`, marks the sandbox claimed and consumes the token. Two
claims must yield one winner. Submission and claim contend on the same row update/lock, so an
in-flight Submission is either copied or retries against the claimed Form.

If the target organization is full, do not consume the sandbox token. Existing users with several
organizations default to the organization scoped by their key/session; never move the Form into
another organization implicitly.

## Lean abuse controls

Start with fixed, conservative hosted limits; do not build a policy engine:

- 24-hour sandbox lifetime
- 5 accepted Submissions per sandbox
- 16 KiB per anonymous payload
- maximum nesting depth 4; the 16 KiB body cap bounds fields and strings
- at most 20 active, unexpired sandboxes per source address (group IPv6 by `/64`)
- one configurable global active-sandbox ceiling
- Cloudflare rate limit on the distinct public creation route only
- one `ANONYMOUS_QUICKSTART_ENABLED` kill switch that stops new creation but never blocks
  claiming or cleanup

Use the sandbox's conditional counter update for its hard ceiling and `count(*)` under a PostgreSQL
advisory lock for the global ceiling. The source-address allowance is a soft fairness guard because
agents and corporate users share egress; the global and per-sandbox ceilings bound cost. Do not
edge-rate-limit `/s/{formId}`, which also serves paying Forms. Before relying on source addresses,
verify separately that the hosted origin accepts forwarded client-IP headers only from the trusted
Cloudflare/Traefik path. Do not add CAPTCHA, fingerprinting, ASN scoring, proof-of-work, risk
scoring or new monitoring infrastructure unless observed abuse justifies it.

## Authentication behavior

- Hosted: set Better Auth `emailAndPassword.disableSignUp`; do not merely hide the form.
- Keep password sign-in for existing accounts and make `/v1/auth/providers` report sign-in and
  signup capabilities separately.
- Keep `/v1/auth/request-code` and `/verify-code`: they already prove inbox control, provision a
  new user's personal organization and mint a manage key without a browser.
- Keep optional `claim_email`, the lean binding between an agent-led OTP claim and its intended
  owner. Include it only when the user explicitly identified their Postbag/login email; never
  infer it from Git metadata or unrelated accounts, and omit it when uncertain.
- No claim-specific OTP flow: the existing email-code flow followed by an idempotent claim call
  is simpler and retryable.

## Implementation order

1. Add a short supporting decision for the anonymous admission exception and add **Sandbox** to
   the vocabulary as a temporary, unclaimed Form. Add migrations, Drizzle schemas and narrow
   sandbox repositories.
2. Define the create/read/claim routes contract-first, implement token/idempotency helpers and
   public create/read, then immediately regenerate OpenAPI, SDK and MCP operations.
3. Add the sandbox branch to `/s/{formId}` using the conditional counter update and claimed-Form
   retry behavior.
4. Add session/API-key claim with Default Project resolution, slug de-duplication, `form.created`,
   stable Form id and original test timestamps.
5. Build `/app/claim#token=...`, following the invitation route's redirect preservation and
   explicit confirmation pattern. Invoke the required interface and transition skills before UI
   work and follow `docs/DESIGN.md`.
6. Add bounded expiry cleanup and structured counters/logs using no raw secrets.
7. Disable hosted password signup, keep self-host fallback, and update provider discovery/UI.
8. Update CLI, Agent Skill, `llms.txt` and agent docs. Change public marketing copy only after the
   deployed flow passes end to end.

## Required proof before launch

- Public create → submit → read works with no account and creates no outbound rows.
- Concurrent creation with one UUIDv4 idempotency key creates one sandbox and returns the same encrypted-
  replayed token; a changed body conflicts.
- Concurrent Submission attempts never exceed five; rejected attempts create no row.
- The sandbox token cannot claim without an authenticated actor; expired and consumed tokens fail.
- Submission-versus-claim and claim-versus-claim races are deterministic on live PostgreSQL.
- Email-bound claim accepts only the matching verified social/OTP identity.
- Email-code onboarding creates/resolves the account, returns a working key and lets the agent
  claim without a browser.
- Browser OAuth claiming preserves the token fragment through redirects and requires confirmation.
- Claim resolves the Default Project, handles slug collision and emits `form.created`.
- Claimed Form keeps the same submit URL; old tests never deliver; new real Submissions can route.
- Target-capacity failure leaves the sandbox claimable.
- Cleanup deletes expired sandboxes and cascades their Submissions.
- Feature-off returns an agent-native error while existing claims and cleanup still work.
- Lint, typecheck, tests, build and generated-contract consistency are green.
- Production canary proves create → submit → verify → email code → agent claim → configure
  Destination → new Submission delivered before any availability claim is published.

## Explicitly out of scope

Anonymous delivery, temporary accounts or organizations, domain ownership verification,
claim-email messages at creation time, CAPTCHA for agent calls, advanced bot intelligence,
multiple allowance tiers, IP reputation work, and recovery machinery for a mistyped optional
email. A bad temporary sandbox expires; the agent creates another one.
