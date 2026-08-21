# PROGRESS — the live blueprint

**Purpose:** if a session dies, the next one (human or agent) reads this file and
continues without reinventing. Keep it current; commit and push it with every
meaningful step. Newest entries at the top of each section. See `CLAUDE.md` for
the rules and `docs/` for the design.

## Current state (update this block, don't append)

- **Phase:** 1 — MVP **live** (overnight autonomous run 2026-08-21; jobs A–E done). Remaining Phase 1 items are in *Next up*.
- **Marketing/docs site:** `apps/site` (Astro 5 static, Tailwind v4, Motion), built into `apps/server/dist/site`
  and served at `/` by `apps/server/src/routes/staticSite.ts` (same image; `/app`, `/v1`, `/s`, `/health`,
  `/llms.txt`, `/openapi.json` reserved). `SITE_URL` env (default `https://postbag.dev`) sets canonical URLs;
  `PUBLIC_API_URL` if the API ever moves. Demo forms in prod org, project `site`: hero demo `fm_73c74vjq6z24`
  (no routes, `_test` only), about-page contact `fm_h6eetntqdbp6` (email route to the owner).
- **Repo:** `github.com/faahim/postbag` (private), default branch `main`
- **Deploy target:** Coolify (control plane `kolkobja.tarpore.com`) → server **megh-oracle**
  (`140.245.57.24`, arm64, uuid `a8w4s8cg0go4kwo0g0gk8co0`). Coolify project "Postbag".
- **Domain:** **`postbag.dev`** (canonical, `APP_URL`) + alias `api.postbag.dev`; zone id `84f7a4a0b32316b3d420ef347d6d494a`
  (Afiur.fahim@gmail.com Cloudflare account). A records (proxied) → megh-oracle. Legacy `postbag.withfaahim.com`
  (zone `4f548539cadf02e52a52ef6957a82e3f`) stays served as an extra Coolify domain so old submit URLs keep working;
  redirect non-`/s` `/v1` paths to postbag.dev (see Next up).
- **Coolify resources:** project `8ngphk5sjmqmwtzvdlr17wcs` · app `ertar2xhyn50wzetdjzzin2g`
  (GitHub App uuid `y0sw00scw8w8k8co0occwgsc`, repo `faahim/postbag`, branch `main`, Dockerfile
  build pack, port 3000, health `/health`, connected to predefined network) · Postgres 16
  `fmeduf0fi7ax0dvsdhsvtewb` (internal host = that uuid, db/user `postbag`). App env vars set:
  `DATABASE_URL`, `NODE_ENV`, `PORT`, `APP_URL`, `BETTER_AUTH_SECRET`, `POSTBAG_ROLE=all`, `TZ`.
  Deploy: `POST $COOLIFY_BASE_URL/api/v1/deploy?uuid=<app>&force=true`; status at
  `GET /api/v1/deployments/<deployment_uuid>`.
- **Credentials:** Coolify API token + Cloudflare token live in `~/Developer/smedja/.env`
  (`COOLIFY_*`, `CLOUDFLARE_*`). GitHub App for `faahim/*` in Coolify = `github_apps.id=2`.
  Never copy secrets into this repo.
- **Implementation engine:** Job A runs on Codex (`conduct` skill). **Codex quota is low
  (Fahim, 2026-08-21 ~22:40 UTC)** → jobs B, C and later run as **Sonnet sub-agents** (Agent
  tool, `model: sonnet`) from the same specs in `tasks/`. Claude (Fable) only writes specs,
  reviews, and commits. Jobs run sequentially (A → B → C) to avoid rework.
- **Auto-deploy on push to `main` is confirmed** (Coolify deployment fired for `ec84d6c`).
- **postbag.dev cut-over done 2026-08-21 12:40 UTC** (`7432e86`): site, `/app`, `/v1`, `/s`, `/openapi.json`
  (`servers: https://postbag.dev`) and `/llms.txt` all serve on `postbag.dev`; `api.postbag.dev` alias works;
  `postbag.withfaahim.com` still serves everything (old embeds keep working). Coolify domains:
  `postbag.dev, api.postbag.dev, www.postbag.dev, postbag.withfaahim.com`; env `LEGACY_HOSTS=postbag.withfaahim.com,www.postbag.dev`
  (redirect middleware ships with job F). Resend `postbag.dev` verified; `MAIL_FROM=Postbag <notify@postbag.dev>`.
  Site forms `fm_h6eetntqdbp6` / `fm_73c74vjq6z24` have `https://postbag.dev` + `https://api.postbag.dev` in `allowed_origins`.
  `~/.postbag/credentials` still says `POSTBAG_URL=https://postbag.withfaahim.com` — both hosts accept the key.

## Decisions made tonight (2026-08-21)

- UI label for `stream` = **Bag**. ("Collection" considered; Bag is on-brand and unambiguous.)
- ADR-003 accepted: dashboard = Vite + React SPA served by the API container.
  **Public/marketing pages are a separate Astro site** (SSR/SSG, SEO + GEO optimised) —
  `apps/site`, Phase 3. Nothing public-facing is rendered client-side.
- ADR-005 accepted: JSONata for mapping expressions, filters, transforms (Phase 2).
- Hosting: megh-oracle chosen over dekhval-1 (Hermes load) and kolkobja (control plane, low RAM).
- **Business model + licence (ADR-006, 2026-08-21):** open source + hosted, plans differ only in
  limits. `AGPL-3.0-only` for root/apps/core/db/auth; `MIT` for sdk/cli/mcp. No CLA (DCO). Prices
  published on `/pricing` ahead of billing: Free $0 · Pro $15/mo ($12 yearly) · Team $49/mo ($39 yearly).
- **Billing provider (ADR-007):** **Polar** as Merchant of Record, Paddle fallback. Dodo Payments was
  evaluated and rejected: Bangladesh (the legal entity's country) is not an eligible merchant country.
  Stripe direct was never available for the same reason. Polar pays Bangladesh via Stripe Connect
  Express cross-border payouts ("Preview" tier — KYC + a real test payout must succeed before billing code merges).
- **Domain:** `postbag.dev` (Fahim buying 2026-08-21). `.app` as a cheap defensive redirect; skip `.io`.
- **Repo goes public** with the first npm release. gitleaks full-history scan 2026-08-21: 18 commits, no leaks.
- npm names `postbag`, `@postbag/sdk`, `@postbag/mcp`, `@postbag/cli` and the `@postbag` scope were all
  free on 2026-08-21; MCP registry has no `postbag` entry.

## Done

- [x] **Marketing + docs site (2026-08-21):** `apps/site`. Home (live demo form, scroll-driven "journey", agent
  transcript, streams diagram, invariants, destinations, self-host, FAQ), `/for-ai-agents/`, `/features/*` (6),
  `/docs/*` (13 pages + `/docs/errors/{code}/` for every API error code; Markdown twins at `index.md`,
  `/llms-full.txt`), `/compare/*` (6 competitors, facts sourced and dated), `/use-cases/*` (5), `/glossary/`,
  `/pricing/`, `/changelog/`, `/about/` (real contact form), 404. SEO/GEO: JSON-LD graph (Organization, WebSite,
  SoftwareApplication, BreadcrumbList, FAQPage, TechArticle, DefinedTermSet), canonical/OG/Twitter, sitemap,
  robots.txt allowing AI crawlers, `Accept: text/markdown` negotiation on the server, `X-Robots-Tag: noindex` on
  Markdown twins. Verified: astro check, eslint, server tests 43/43, built site served by the server locally.

- [x] Phase 0 docs committed (`042d820`).
- [x] GitHub repo created, pushed, default branch `main`.
- [x] DNS `postbag.withfaahim.com` created (proxied).
- [x] Coolify project "Postbag" created.

- [x] Coolify application + Postgres resource created and wired (see Current state)
- [x] Placeholder Dockerfile deployed → `https://postbag.withfaahim.com/health` = 200 (deployment `podwf2dxeqjf8s0xtp0vpk0i`, 2026-08-21). Pipeline proven: GitHub → Coolify → Traefik → Cloudflare.
- [x] Job A (Codex, spec `tasks/job-A-scaffold.md`): monorepo + `packages/core` (pure domain, 10 test files) + `packages/db` (23 tables, 1 migration, claim/notify helpers) + `packages/auth` (Better Auth, org-owned API keys via `referenceId`→`organization_id`). Codex's sandbox had no network/Docker, so Claude installed deps and verified: lint 0, typecheck ok, migrate ok, 49/49 tests. Fixed by Claude: pnpm `allowBuilds`, ESLint typed-rule scoping, engine range.
- [x] Job B (Sonnet, spec `tasks/job-B-server.md`): `apps/server` — submit path, `/v1` (all openapi paths), Better Auth + API keys + org provisioning on signup, worker with email/telegram/webhook adapters, `/health`, `/llms.txt`, generated `/openapi.json`, multi-stage Dockerfile. Verified by Claude: lint 0, typecheck ok, 72/72 tests, image builds. Known gaps (tracked in Next up): system-webhook dispatch, digest sending, schema inference for `observe`, RLS second fence, `drizzle-kit generate` broken by `@postbag/core` export map (migration 0001 hand-written).

- [x] Job E (Sonnet, spec `tasks/job-E-design-polish.md`): display-scale first-run headline, accent-red brand postmark, staggered "It arrived" reveal, inbox id chips + postmark status + fade truncation, delivery timeline, collapsible meta, hover lift. Verified: lint 0, typecheck ok, build ok. **Honest verdict:** better, still "tidy" rather than "distinctive" — the next design step should be a session with Fahim's eye (swatches, hero composition, illustration family), not another agent pass.
- [x] `staticApp.ts` now also resolves `dist/public` when run from source, so `pnpm --filter @postbag/server dev` serves a built SPA.
- [x] Job D (Sonnet, spec `tasks/job-D-server-followups.md`): scope implication (`manage ⊇ read ⊇ submit`), template context with real names, CF client IP/country, isolated worker tests, **system-webhook dispatch via Postgres trigger** + `system_webhook_deliveries` + `GET /v1/webhooks/{id}/deliveries`, digest routes (one payload per period), observe-mode inference (`form_schema_drafts`, `POST /v1/forms/{id}/schema/infer`), `drizzle-kit generate` fixed (export map + reconstructed snapshots), RLS policies + `postbag_app` role (migrations 0002, 0003). Claude removed `FORCE ROW LEVEL SECURITY` (would break non-superuser self-host owners; Principle 7) — owners exempt, `postbag_app` fenced. **Open:** request-path `SET LOCAL ROLE postbag_app` + `app.org_id` (flag `RLS_ENFORCED`, inert). Verified by Claude on a fresh DB: lint 0, typecheck ok, 110/110 tests, image builds.
- [x] **Dashboard live in production** at `https://postbag.withfaahim.com/app/` (deploy of `6ec3802`, 2026-08-21 00:32 UTC; CI green). Sign in with the account in `~/.postbag/credentials`.
- [x] Job C (Sonnet, spec `tasks/job-C-dashboard.md`): `apps/web` (Vite+React+shadcn, all 10 screens, postmark motif, Instrument Sans/JetBrains Mono, wax-seal accent, ⌘K, live inbox) + `packages/sdk` (openapi-typescript + openapi-fetch). SPA builds into `apps/server/dist/public`, served at `/app`. Verified by Claude: lint 0, typecheck ok, 81 tests (worker tests need a clean DB — see job D), Docker image serves `/app` + `/health`. Design verdict: coherent and clean; a dedicated polish pass (job E) should push it from 'tidy' to 'distinctive'.
- [x] **Production verified end-to-end 2026-08-21 23:25 UTC:** `d4a8f3a` deployed; `/health` db up + worker alive; signup → `/v1/me` → API key → `/v1/quickstart` → real submission → email delivered via Resend in ~1 s and confirmed in Fahim's Gmail.
  Fahim's production account: `afiur.fahim@gmail.com`, org `org_3yv5z32sed4q`, project `postbag`, form `fm_gwdahpd22tjy` ("Overnight smoke test"). Password + full-scope API key saved at **`~/.postbag/credentials`** (mode 600, not in repo).

- [x] **Job F (2026-08-21, Sonnet agents × 3, spec `tasks/job-F-cli-mcp.md`):** 59→60 `operationId`s + `bearerAuth`;
  `api/openapi.yaml` generated (`pnpm openapi:export`, sync test); `@postbag/sdk` publishable; `LEGACY_HOSTS` redirect
  (live: withfaahim → postbag.dev, `/s` `/v1` untouched); **`packages/cli`** (npm `postbag`, 29 tests, smoke-tested
  against prod); **`packages/mcp`** (`@postbag/mcp`, 62 tools, `server.json`, smoke-tested against prod). CI green
  from `eb92643`. Not yet published (needs `npm login` + `NPM_TOKEN`).
- [x] **Job G (2026-08-21, spec `tasks/job-G-social-login.md`):** Google + GitHub via Better Auth, `GET /v1/auth/providers`,
  SocialButtons + Connected accounts card. Linking kept at secure defaults (reviewer reverted the agent's
  `trustedProviders` + `requireLocalEmailVerified:false` — pre-registration takeover). Providers activate the moment
  `GOOGLE_*`/`GITHUB_*` env land on Coolify (`VITE_HOSTED=1` build arg already set).

- [x] **Job H (2026-08-21, spec `tasks/job-H-agent-onboarding.md`):** `POST /v1/auth/request-code` + `/verify-code`
  (Better Auth `emailOTP`, hashed 6-digit, 3 attempts, 3/email + 10/IP per 10 min, no cookie, mints a key through the
  same helper as `/v1/api-keys`); `postbag login` drives it (`--email`, `--code`); `skills/postbag/SKILL.md` served at
  `/.well-known/skills/` (bundled into dist by the server build); landing "set up your agent" block; llms.txt section.
  184 tests.

## Next up (in order)

0. Design session with Fahim on the dashboard (see Job E verdict). Screenshots: session scratchpad `web-shots/` (before) and `web-shots-v2/` (after).
1. Wire RLS into the request path (`RLS_ENFORCED=true`: per-request transaction with `SET LOCAL ROLE postbag_app` + `set_config('app.org_id')`); then flip the default on. Sync `api/openapi.yaml` with the generated doc (new: `/v1/forms/{id}/schema/infer`, `/v1/webhooks/{id}/deliveries`, `SchemaVersion.inferred`).
2. ~~CLI + MCP~~ **published 2026-08-21.** npm: `postbag@0.1.0`, `@postbag/sdk@0.1.0`, `@postbag/mcp@0.1.1` — first
   versions by Fahim with 2FA, then **trusted publishing (OIDC)** configured per package (`npm trust github … --file
   release.yml`); `release.yml` publishes on `v*` tags with no secret (verified: v0.1.1 run published via OIDC). The
   `NPM_TOKEN` GitHub secret is deleted; **Fahim: revoke the bypass-2FA GAT on npmjs.com**. Bypass-2FA tokens lose
   publishing ~Jan 2027 (github.blog 2026-07-08) — we're already off them. **MCP registry:** `dev.postbag/mcp` 0.1.1
   listed (DNS-verified; apex TXT on postbag.dev; key `~/.config/postbag/mcp-registry-ed25519.pem`, login command in
   `release.yml`'s sibling notes above). Each new MCP version: bump `packages/mcp/package.json` + `server.json`, tag,
   then `mcp-publisher login dns … && mcp-publisher publish`. Site copy flipped. **Still open: make the repo public**
   (gitleaks clean; unlocks npm provenance and `npx skills add faahim/postbag`).
2b. **Legal pages before selling (agent drafts, Fahim supplies entity name/address):** Terms, Privacy
   Policy, DPA for operators, sub-processor list (Resend, Cloudflare, the hosting provider, Polar),
   GDPR Art. 27 EU-representative answer for a non-EU entity. Pages at `/legal/terms/`, `/legal/privacy/`, `/legal/dpa/`.
2c. **Human (Phase 3 gate):** create the Polar organisation, complete KYC with Bangladeshi documents and a
   local bank account, confirm a sandbox sale and a real test payout land. If it fails → Paddle via a
   superseding ADR. No billing code merges before this.
2d. ~~Social login~~ **live 2026-08-21 14:40 UTC.** Google + GitHub buttons on `postbag.dev/app/sign-in`;
   `/v1/auth/providers` → `["google","github"]`. GitHub OAuth app `Postbag` (client id `Ov23li80jqB1DXPzvMsP`,
   callbacks postbag.dev + localhost:3000). Google: GCP project **`postbag-dev`**, consent screen published
   **In production** (External, non-sensitive scopes, privacy URL `/about/#privacy` — replace with `/legal/privacy/`
   once 2b ships), web client "Postbag web" (`596015045839-…apps.googleusercontent.com`), same two callbacks.
   Secrets live only in Coolify env (`GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`). Verified: both buttons
   hand off to the right provider with the right redirect_uri; a full login round-trip is Fahim's to try.
2f. **Email verification on password sign-up** (follow-up to social login): Better Auth `emailVerification`
   with `sendOnSignUp: true` via Resend (`requireEmailVerification` stays false so the 3-minute test holds).
   Until a password account is verified, Better Auth will not auto-link a same-email Google/GitHub sign-in
   (by design — pre-registration takeover); the sign-in page explains to use the password and connect from
   Settings. Also: resend-verification button in Settings → Profile.
2e. **Agent onboarding** — (a)+(b) shipped (job H); (c) anonymous/claimable quickstart awaits Fahim: (a) agent-assisted signup without a browser —
   `POST /v1/auth/request-code {email}` → emailed 6-digit code (Better Auth `emailOTP` plugin) →
   `POST /v1/auth/verify-code {email, code, key_name}` creates user+org if new and returns a `pb_live_` manage key
   the agent stores in `~/.config/postbag/credentials.json`; (b) an Agent Skill in-repo (`skills/postbag/SKILL.md`,
   installable with `npx skills add faahim/postbag`, discoverable at `/.well-known/skills/`), with the landing page
   offering "paste this to your agent"; (c) later: anonymous `POST /v1/quickstart` (no auth) that creates a 24-hour
   sandbox form that stores but does not deliver, plus a `claim_url` that a Google/GitHub sign-in turns into a real
   org — deliveries unlock after claim. (a)+(b) are cheap and safe; (c) needs Fahim's yes (abuse surface, retention).
3. Dogfood: portfolio contact form → Postbag. Then Smedja `forge` provisioning.
4. ~~Marketing site~~ shipped (see Done). Still open: **domain cut-over to `postbag.dev`** (decided; change
   `SITE_URL` + Coolify `APP_URL` + Resend sending domain together, and add `https://postbag.dev` to
   `allowed_origins` on the site form `fm_h6eetntqdbp6` or the contact + pricing-notify forms break), Bing
   Webmaster Tools + Google Search Console verification and IndexNow, confirm Cloudflare "block AI bots" is off for
   the zone, publish SDK/CLI/MCP to npm + MCP registry (the site's agent pages say these are in progress).

- **Email:** Resend account = the key in `~/Developer/vendingmachine-stuff/.env` (only account on disk;
  `updates.withfaahim.com` belongs to some other account). Sending domains in Resend (eu-west-1):
  **`postbag.dev`** (id `efc09584-3583-409f-841d-907bfd47750c`, DKIM/SPF/MX added to Cloudflare 2026-08-21) and legacy
  `postbag.withfaahim.com` (id `fda6ffab-c792-42f3-bc76-0e03fbd7e80b`). `MAIL_FROM=Postbag <notify@postbag.dev>` once
  verified; `RESEND_API_KEY` set on the Coolify app.

## Gotchas learned

- pnpm 11: build-script approval lives in `pnpm-workspace.yaml` under `allowBuilds:` (not `package.json.pnpm`).
- Local dev Postgres: `docker compose up -d db` → `postgres://postbag:postbag@localhost:5433/postbag` (OrbStack). To reset it, drop **both** `public` and `drizzle` schemas (drizzle tracks applied migrations in `drizzle.__drizzle_migrations`) and `drop role postbag_app`.
- `pnpm lint` builds core+db first (typed linting needs their d.ts); config files are excluded from typed rules.

- `source ~/Developer/smedja/.env` breaks in bash (an unquoted value on line 11); read vars with
  `grep '^NAME=' | cut -d= -f2-` instead.
- Coolify's `/api/v1/sources` does not exist; GitHub App uuids come from the Coolify DB on
  kolkobja: `docker exec coolify-db psql -U coolify -d coolify -c 'select id,uuid,name from github_apps'`.
- Coolify builds on the target server → images are arm64 on megh-oracle. Use multi-arch base images only.
