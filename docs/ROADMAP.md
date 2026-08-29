# Roadmap

Phases are scoped by what they prove, not by calendar. Each phase ends when its
exit test passes on real traffic.

## Phase 0 — Contract _(now)_

Principles, domain model, architecture, API contract, agent-native spec. No code.
**Exit:** Fahim signs off on the docs; the OpenAPI sketch covers every Phase 1 call.

## Phase 1 — MVP, dogfooded on new sites

- Monorepo, Postgres, Drizzle migrations, Better Auth (users, orgs, API keys).
- `POST /s/{id}`: urlencoded + multipart attachments + JSON; honeypot; origin
  allowlist; per-form rate limit; `_redirect`; `_test`; idempotency. Attachments use
  S3-compatible storage, private metadata, authenticated download and signed
  Delivery links.
- Forms, projects, submissions (list/get/search), form schemas with `observe` and
  `managed` modes, drift **detection** (events + dashboard badge; no inference yet).
- Streams with explicit and tag sources, **direct field mapping** (no expressions),
  stream schemas.
- Destinations: `email`, `telegram`, `webhook` (signed). `/test` for each.
- Routes: instant mode, `window`, quality defaults. Outbox worker with retries,
  `dead` alerts, `LISTEN/NOTIFY` + tick.
- Events log + org system webhooks.
- Dashboard: Forms → Submissions, Destinations, "Send to" on a form, Streams behind
  "Group forms". Minimal but polished on the solo-dev path.
- `/v1/quickstart`, `llms.txt`, `/openapi.json`, generated SDK, CLI `init`, MCP server.
- Single Docker image + `docker-compose.yml`; deployed on Coolify at `api.postbag.dev`.

**Exit:** (a) a fresh Claude Code session in a new site repo, given only an API key,
ships a working contact form with email + Telegram in one conversation; (b) the
portfolio site and every _new_ site use Postbag; (c) solo-dev test < 3 min.

## Phase 2 — The operator's product, proven on the vending fleet

- Mapping expressions + route `filter` + `transform` (ADR-005).
- `enforce` mode with quarantine; schema **inference** for `observe` forms; drift
  resolution flow ("publish v2 from what we're seeing").
- Digest routes (daily summary, timezone-aware), Slack/Discord destinations,
  Turnstile, spam heuristics, retention.
- **Vending migration in shadow mode:** the 19 sites post to PocketBase _and_
  Postbag; a comparison report runs daily until deliveries match for a week. Only
  then does HonestBox's route go live and the old worker retire. Not before the
  trial window ends (17 Sep 2026) unless parity is already proven.
- Smedja: `forge` provisions a `managed` form per site and writes `postbag.json`.

**Exit:** the vending pipeline is decommissioned; the HonestBox partner notices nothing.

## Phase 3 — Commercial

- Billing via Polar as Merchant of Record (ADR-007): checkout, customer portal,
  durable signed subscription webhooks, plans, limits, monthly usage, retention, and
  over-quota behaviour. Self-host runs with billing disabled and self-host limits.
- Team invitations, roles, audit log UI, data export, GDPR deletion.
- Per-org verified sending domains; optional custom submit domain.
- Native destinations where the webhook path has shown a pattern: Dekhval (CRM
  lead), Smedja.
- Public launch: landing page, docs site, `formsforagents`-style descriptive
  domains redirecting in, templates gallery.

**Exit:** first paying organisation that is not one of ours.

## Deliberately deferred / declined

| Item                                           | Why                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Visual form builder                            | Principle 6.                                                      |
| Redis / external queue                         | ADR-002; revisit only if Postgres contention is measured.         |
| Multi-region submit edge                       | Revisit if p95 submit latency from target markets exceeds 300 ms. |
| Native integrations before webhooks prove them | Each native destination is maintenance forever.                   |
