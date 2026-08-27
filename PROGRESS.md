# PROGRESS — the live blueprint

**Purpose:** if a session dies, the next one (human or agent) reads this file and
continues without reinventing. Keep it current; commit and push it with every
meaningful step. Newest entries at the top of each section. See `CLAUDE.md` for
the rules and `docs/` for the design.

## Current state (update this block, don't append)

- **Phase:** 1 — MVP **live** (overnight autonomous run 2026-08-21; jobs A–E done). Remaining Phase 1 items are in _Next up_.
- **Brand overhaul complete on `codex/brand-overhaul` 2026-08-24:** `docs/BRAND.md` is the source of truth. The approved
  receiving-pocket hero now leads one coherent midnight-indigo/periwinkle identity across the complete homepage,
  public page family, documentation shell, auth, first-run, empty/status states, manifests and social previews. The old
  red circular check/postmark family is replaced by the receiving/routing mark; ordinary interface checks remain
  ordinary. The documentation family received its final editorial polish on 2026-08-25: routing-aware navigation,
  live page context, copyable language-labelled code, improved reading typography and responsive API error pages now
  share one shell. File-like `index.md` twins also resolve consistently in Astro preview and the production static server,
  with direct-link and content-negotiation regression coverage. A shared static material grain now carries through the
  marketing, docs, auth and dashboard canvases while
  inputs, code, payloads, tables and other working planes remain clear. Public claims were reconciled to the live
  anonymous sandbox/claim contract, public GitHub repository and
  published npm clients. Static gates, 164 tests, production builds and settled browser checks at desktop/tablet/mobile
  are green on the branch; merge and production deployment remain intentionally pending.
- **Anonymous claimable quickstart live 2026-08-23 (ADR-008/009):** `ANONYMOUS_QUICKSTART_ENABLED=true`. Merge `54c4fd8`
  shipped the bounded 24-hour sandbox flow; closeout `b273d46` and API-key-name validation fix `bed1ebd` are deployed
  (`loqdcusasbxdn106nvgrsgu7`, `wqahvskwleapheboflsy0bin`, `mi1vbrf4wdgurxlgldp9hbuh`). Local Postgres, 308 tests,
  CI, build, lint, typecheck, generated OpenAPI/SDK/MCP consistency and settled desktop/tablet browser proof are green.
  The production canary proved anonymous create → inert pre-claim Submission → email OTP → email-bound claim with the
  same Form id → one copied test → email Destination/Route → new real Submission → Delivery `sent`; exact canary Route,
  Destination, Form and API key cleanup all returned 204 and database checks confirmed their rows were gone. The claimed
  sandbox token is consumed and its bounded staging/audit rows remain only until retention cleanup.
- **Anonymous launch edge gates live 2026-08-23:** Cloudflare rate-limits exact path `/v1/public/sandboxes` to 5 requests
  per 10 seconds with a 10-second mitigation on `postbag.dev` (ruleset `37d4427504ac486d9f23a79430e35f24`, rule
  `5556f58b2f6b4629bc5d00eb49521a17`) and the legacy hostname (ruleset `97ae2355a19e40d0ba57ac3caea30bf0`,
  rule `9bff653c3e06475a854740fe16eda41b`). Traefik middleware
  `postbag-cloudflare-only-jfw5odopfompxmpq7ffgrtn9` contains Cloudflare's authoritative IPv4/IPv6 ranges and is attached
  only to Postbag's four HTTP and four HTTPS routers. Edge health is 200; direct-origin HTTP/HTTPS and spoofed forwarded
  headers are 403. Langluer, Anu, Dekhval, Surayt and vending-pipeline health/status stayed unchanged. Keep
  `postbag.withfaahim.com` secured and served until old-submit-url usage is inventoried; retire it separately, not blindly.
- **Marketing/docs site:** `apps/site` (Astro 5 static, Tailwind v4, Motion), built into `apps/server/dist/site`
  and served at `/` by `apps/server/src/routes/staticSite.ts` (same image; `/app`, `/v1`, `/s`, `/health`,
  `/llms.txt`, `/openapi.json` reserved). `SITE_URL` env (default `https://postbag.dev`) sets canonical URLs;
  `PUBLIC_API_URL` if the API ever moves. Demo forms in prod org, project `site`: hero demo `fm_73c74vjq6z24`
  (no routes, `_test` only), about-page contact `fm_h6eetntqdbp6` (email route to the owner).
- **Repo:** `github.com/faahim/postbag` (**public** since 2026-08-21; AGPL-3.0 + MIT clients), default branch `main`
- **Deploy target (since 2026-08-21 16:04 UTC):** Coolify (control plane `kolkobja.tarpore.com`) → server **dekhval-1**
  (Hetzner Nuremberg, DE/EU, `159.69.144.166`, x86_64, uuid `lksgcsw84skoc8o0488o40og`). App **`postbag-eu`**
  `jfw5odopfompxmpq7ffgrtn9`, Postgres 16 **`postbag-db-eu`** `oxowkoj5egbcqjibdnoy30sf` (backup schedule
  `lsvi1rsnoo8erhsfugiznstn`, daily 03:00, 14 d local). Migrated from **megh-oracle** (Oracle Singapore, arm64) by
  pg_dump/restore; the old app `ertar2xhyn50wzetdjzzin2g` and old DB `fmeduf0fi7ax0dvsdhsvtewb` were **deleted from Coolify
  2026-08-21 16:22 UTC** (Fahim's request, after parity verification); a final dump is at
  `~/.config/postbag/backups/postbag-megh-oracle-final-20260821T162011Z.sql.gz` (600). Root SSH works to both servers from Fahim's Mac.
- **Domain:** **`postbag.dev`** (canonical, `APP_URL`) + alias `api.postbag.dev`; zone id `84f7a4a0b32316b3d420ef347d6d494a`
  (Afiur.fahim@gmail.com Cloudflare account). A records (proxied) → dekhval-1. Legacy `postbag.withfaahim.com`
  (zone `4f548539cadf02e52a52ef6957a82e3f`) stays served as an extra Coolify domain so old submit URLs keep working;
  redirect non-`/s` `/v1` paths to postbag.dev (see Next up).
- **Coolify resources (historical, deleted 2026-08-21):** project `8ngphk5sjmqmwtzvdlr17wcs` · app `ertar2xhyn50wzetdjzzin2g`
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

- UI label for `stream` = **Stream** (supersedes the 2026-08-21 “Bag” experiment; fixed domain vocabulary now matches
  the dashboard, public site and generated API clients).
- ADR-003 accepted: dashboard = Vite + React SPA served by the API container.
  **Public/marketing pages are a separate Astro site** (SSR/SSG, SEO + GEO optimised) —
  `apps/site`, Phase 3. Nothing public-facing is rendered client-side.
- ADR-005 accepted: JSONata for mapping expressions, filters, transforms (Phase 2).
- Hosting: megh-oracle chosen over dekhval-1 (Hermes load) and kolkobja (control plane, low RAM).
- **Business model + licence (ADR-006, 2026-08-21):** open source + hosted, plans differ only in
  limits. `AGPL-3.0-only` for root/apps/core/db/auth; `MIT` for sdk/cli/mcp. No CLA (DCO). Prices:
  Free $0 · Pro $15/mo ($12 yearly) · Team $49/mo ($39 yearly). Production Polar has monthly and
  annual catalog prices for both Pro and Team.
- **Billing provider (ADR-007):** **Polar** as Merchant of Record, Paddle fallback. Dodo Payments was
  evaluated and rejected: Bangladesh (the legal entity's country) is not an eligible merchant country.
  Stripe direct was never available for the same reason. Polar pays Bangladesh via Stripe Connect
  Express cross-border payouts ("Preview" tier). Billing commit `ba38622` is live in production:
  migration 0006, plan enforcement, monthly usage, retention, checkout, portal and durable signed
  webhook processing. The production catalog, webhook endpoint and masked Coolify billing env vars
  are configured. Hosted health, worker, pricing, authenticated Settings and signature rejection were
  verified. No real paid purchase, KYC/account review completion or payout has been proven.
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

- [x] Job E (Sonnet, spec `tasks/job-E-design-polish.md`): historical dashboard polish pass. Its accent-red postmark treatment was retired by the 2026-08-24 brand overhaul in favour of periwinkle receiving/routing marks. Original verification: lint 0, typecheck ok, build ok.
- [x] `staticApp.ts` now also resolves `dist/public` when run from source, so `pnpm --filter @postbag/server dev` serves a built SPA.
- [x] Job D (Sonnet, spec `tasks/job-D-server-followups.md`): scope implication (`manage ⊇ read ⊇ submit`), template context with real names, CF client IP/country, isolated worker tests, **system-webhook dispatch via Postgres trigger** + `system_webhook_deliveries` + `GET /v1/webhooks/{id}/deliveries`, digest routes (one payload per period), observe-mode inference (`form_schema_drafts`, `POST /v1/forms/{id}/schema/infer`), `drizzle-kit generate` fixed (export map + reconstructed snapshots), RLS policies + `postbag_app` role (migrations 0002, 0003). Claude removed `FORCE ROW LEVEL SECURITY` (would break non-superuser self-host owners; Principle 7) — owners exempt, `postbag_app` fenced. **Open:** request-path `SET LOCAL ROLE postbag_app` + `app.org_id` (flag `RLS_ENFORCED`, inert). Verified by Claude on a fresh DB: lint 0, typecheck ok, 110/110 tests, image builds.
- [x] **Dashboard live in production** at `https://postbag.withfaahim.com/app/` (deploy of `6ec3802`, 2026-08-21 00:32 UTC; CI green). Sign in with the account in `~/.postbag/credentials`.
- [x] Job C (Sonnet, spec `tasks/job-C-dashboard.md`): `apps/web` (Vite+React+shadcn, all 10 screens, ⌘K, live inbox) + `packages/sdk` (openapi-typescript + openapi-fetch). SPA builds into `apps/server/dist/public`, served at `/app`. Its original wax/postmark identity was superseded by the 2026-08-24 brand overhaul. Original verification: lint 0, typecheck ok, 81 tests.
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

- [x] **Job M (2026-08-22, Stream first-run — Eric's "Publish a stream schema before attaching sources" dead end):**
      the dashboard could not publish a Stream Schema, so a fresh Stream was unusable. Fixed end to end: server derives a
      Stream's **version 1 from the first attached Form** (published Schema → inferred draft → recent Submissions; identity
      mapping; `stream.schema.changed` event records `derived_from`) in both `POST /v1/streams` and
      `POST /v1/streams/{id}/sources`; new error code `stream_schema_missing` (core + site errors page) replaces the bare
      422 when nothing can be derived. Dashboard: `StreamExplainer` (receiving-pocket SVG/SMIL animation + plain-language
      copy + numbered steps) on the Streams list and on every fresh Stream, first-Form attach from the explainer, `ShapeEditor`
      on "What gets delivered" (fields/type/required, seed from a Form, publish vN+1), Sources show Form names, pre-match
      same-named fields on attach, detach, preview by name + `extras` note, header badges. `toastApiError` shows the API
      `hint` as the toast description app-wide (Streams, Mapping editor, plan card, members). Docs: routing.md,
      DOMAIN-MODEL.md (StreamSchema), errors.md, SKILL.md, CLI option help, OpenAPI + MCP operations regenerated.
      Verified locally in the browser (light + dark); lint 0, typecheck ok, 239/239 tests.

- [x] **Destinations list (2026-08-22):** rows showed only name + type ("Email / Email"). Now: type icon + badge,
      a summary of where it sends (to/cc, chat id, URL host+path) from the already-returned redacted config, health dot
      with tooltip, **Edit** (sheet; blank secret = keep), delete with confirm + hinted errors. Email form accepts several
      recipients, cc and a subject template. Unnamed destinations are named after where they send
      (`eric@example.com`, `hooks.example.com`, `Telegram chat …`) instead of their type.

- [x] **API-vs-dashboard sweep (2026-08-22):** diffed the 76 OpenAPI operations against the 53 the dashboard called.
      Fixed the human-facing gaps: **delete submission** (drawer, confirmed); **route delivery mode** — add-route dialog
      offers instant / daily digest / weekly digest (time, weekday, org timezone) and the routes list shows the mode,
      destination summary and a paused badge, with confirmed removal; **Events → Webhooks** (org-level system webhooks, a tab beside the event log so they don't collide with webhook _destinations_:
      list, add with grouped event checkboxes + secret, pause/resume, remove, recent deliveries); **schema version history**
      on the form's Fields tab. Left agent/admin-only on purpose: auth codes, plan grants, single-resource GETs, schema
      infer (the Fields tab's "Publish what we're seeing" covers it). **Projects** stay hidden in the UI (Principle 1).

- [x] **Polar billing wiring live (2026-08-23, `ba38622`):** migration 0006, checkout and customer
      portal routes, durable signed webhook ingestion/processing, plan enforcement, monthly usage and
      retention. Production Polar has Pro and Team monthly/annual catalog prices, the signed webhook
      endpoint exists, and Coolify has masked billing env vars. Coolify deployment
      `mi8j9gmthrh8p8ss9p2a3yss` finished healthy; hosted health/worker, pricing, authenticated Settings,
      canonical redirects and unsigned-webhook rejection were verified. Existing production workspaces
      are complimentary, so checkout is intentionally hidden there; successful checkout creation is
      covered by the live-DB integration suite, not by a real production charge.

- [x] **Dashboard design sweep (2026-08-26, branch `codex/brand-overhaul`):** the "design session on the dashboard"
      from Next-up item 0 — the brand overhaul finally reaches the product's core. Tactile buttons (the site's grain-face
      `--btn-*` material ported to both dashboard themes; primary + outline variants), spacious two-line tables on
      `.list-surface` planes, an Inbox that reads like an inbox (headline-first letter rows via `headline()`, status
      apertures, Form names instead of ids), a shared `PageHeader`, larger type throughout, enter choreography
      (`page-enter` / `row-enter` staggers), sliding active pills in the sidebar nav and Tabs (transitions-dev
      tabs-sliding on Radix), warm product-register empty states everywhere, and the large ambient `BrandMark`
      greeting the empty Inbox and first-run (also committed: the animated BrandMark migration into web + site footer,
      `8808331`). Fixed-vocabulary copy pass over dialogs/confirms/palette; PlanCard header de-echoed; workspace wording
      unified. Verified in the browser light + dark with seeded local data (3 Forms, 10 Submissions, retrying
      Deliveries); typecheck 0, eslint 0, 12/12 web tests, build ok. Local dev DB now holds seed data and a spare
      empty "Design QA" workspace for empty-state review. **Review sweep (`335427e`)** from Fahim's pass: dark
      `--warning-foreground` contrast fix, `ConfirmDialog` replaces every `window.confirm`, sheet/dialog/palette polish,
      deliveries-dialog overflow fix, drawn empty-state mark, embed's double tab bar folded into one code card,
      Events/Settings became layout routes (tabs swap content only), Route delivery-cadence editing, a Form-Fields
      editor (publishes vN+1), and **`PATCH /v1/organizations/active`** (workspace timezone, owner/admin, contract-first —
      openapi + SDK regenerated) behind a searchable timezone picker in Settings. Server 174/174 on the local DB
      (stop the dev worker first — it races the webhook-deliveries test), web 12/12, eslint 0. The local development
      database contains disposable QA credentials; keep those in local-only notes rather than this public repository.

## Handoff (2026-08-21 ~22:50 UTC — session ended near a usage limit; resume from here)

**Committed and live:** everything above plus job J (agent-first hero, switcher, pricing cards, first-paint reveal fix —
`e6a6088`, deploying on push). Edge caching on. Production on dekhval-1 (EU). Repo public. npm + MCP registry published.

**State (2026-08-21 ~23:20 UTC):** Jobs J, K and **L are all committed** (`e6a6088`, `6c9208f`, `af7a860`) — nothing is
in flight. Note: while job L ran, a second Claude session was working the same spec in the same tree (probably opened
from this handoff); the agent reconciled both. **If you are that other session: everything is merged and pushed — pull
`main` and do not re-apply your working copy.** Migrations 0004 (plan grants) and 0005 (invitation.inviter_id nullable)
run on deploy (`MIGRATE_ON_BOOT=true`).

**Next (priority):** 1) off-server backups — Cloudflare R2 as a Coolify S3 storage + `save_s3` on schedule
`lsvi1rsnoo8erhsfugiznstn`; 2) email verification on password sign-up (2f); 3) Google branding verification + Search
Console via DNS TXT; 4) uptime monitor on `/health`; 5) RLS in the request path; 6) complete Polar KYC/account
review and prove a real paid purchase/payout; 7) CLI unit tests for
`orgs/members/invitations`; 8) an "invite as owner" path if ever needed (today: invite as admin, then promote).

**Done 2026-08-21 17:08 UTC:** Fahim's org redeemed a Team grant (`plan_source=complimentary`, note "The house");
a single-use Pro grant (365 d, note "Eric — friend of the house") was minted and the code handed to Fahim in chat —
codes are never written to the repo. Eric redeems it in Settings → Plan → "Have a code?" (or `postbag plan redeem`).

**Hero polish (small, not done):** centre the Prompt/Skill/MCP/CLI segmented control under the prompt block; make
sure the prompt's wrapped layout is CSS-only at first paint (300 ms screenshot showed a single clipped line).

**Decisions today (all recorded above in detail):** AGPL+MIT; Polar (production org "Postbag", slug `pushkunni`);
prices; anonymous quickstart was declined on 2026-08-21 and superseded by ADR-008 on 2026-08-23; repo public; EU hosting; legal identity = Md Afiur
Rahman, Dhaka 1209, hello@postbag.dev.

**Still open, in priority order:** off-server backups (Cloudflare R2 in Coolify) → email verification on password
sign-up (2f) → Google branding verification + Search Console (DNS TXT) → uptime monitor on `/health` → RLS in the
request path → Polar KYC/account review, real purchase and payout proof (Phase 3).

**Credentials/locations (values never in repo):** `~/.postbag/credentials` (API key, prod URL still says withfaahim —
both hosts work), `~/.config/postbag/{mcp-registry-ed25519.pem,polar-access-token,backups/}`, Cloudflare + Coolify
tokens in `~/Developer/smedja/.env` (Cloudflare token: DNS only; no Email Routing/Cache/Settings scope), Resend key in
`~/Developer/vendingmachine-stuff/.env`. Root SSH works to `root@159.69.144.166` (throttles after bursts) and
`root@140.245.57.24`.

## Next up (in order)

0. ~~Design session with Fahim on the dashboard~~ **done 2026-08-26** (see "Dashboard design sweep" above; awaiting Fahim's review on `codex/brand-overhaul`).
1. Wire RLS into the request path (`RLS_ENFORCED=true`: per-request transaction with `SET LOCAL ROLE postbag_app` + `set_config('app.org_id')`); then flip the default on. Sync `api/openapi.yaml` with the generated doc (new: `/v1/forms/{id}/schema/infer`, `/v1/webhooks/{id}/deliveries`, `SchemaVersion.inferred`).
2. ~~CLI + MCP~~ **published 2026-08-21.** npm: `postbag@0.1.0`, `@postbag/sdk@0.1.0`, `@postbag/mcp@0.1.1` — first
   versions by Fahim with 2FA, then **trusted publishing (OIDC)** configured per package (`npm trust github … --file
release.yml`); `release.yml` publishes on `v*` tags with no secret (verified: v0.1.1 run published via OIDC). The
   `NPM_TOKEN` GitHub secret is deleted; **Fahim: revoke the bypass-2FA GAT on npmjs.com**. Bypass-2FA tokens lose
   publishing ~Jan 2027 (github.blog 2026-07-08) — we're already off them. **MCP registry:** `dev.postbag/mcp` 0.1.1
   listed (DNS-verified; apex TXT on postbag.dev; key `~/.config/postbag/mcp-registry-ed25519.pem`, login command in
   `release.yml`'s sibling notes above). Each new MCP version: bump `packages/mcp/package.json` + `server.json`, tag,
   then `mcp-publisher login dns … && mcp-publisher publish`. Site copy flipped. **Repo public since 2026-08-21 15:15 UTC** (gitleaks clean); `--provenance` re-enabled in `release.yml`.
   2b. **Legal pages before selling (agent drafts, Fahim supplies entity name/address):** Terms, Privacy
   Policy, DPA for operators, sub-processor list (Resend, Cloudflare, the hosting provider, Polar),
   GDPR Art. 27 EU-representative answer for a non-EU entity. Pages at `/legal/terms/`, `/legal/privacy/`, `/legal/dpa/`.
   2c. **Polar:** production organisation "Postbag" (slug `pushkunni`) has Pro and Team monthly/annual catalog
   prices. A production webhook endpoint exists, and Coolify has the masked billing env vars. The local billing code
   includes migration 0006, checkout/portal, durable webhook processing, plan enforcement, monthly usage and
   retention. Do not claim this is deployed: hosted runtime verification is still pending. Separately track
   Billing commit `ba38622` is deployed and hosted health, worker, pricing, authenticated Settings and
   webhook signature rejection are verified. Separately track KYC/account review, a compatible local
   payout account, the first real paid purchase and the first payout as operational evidence; none blocks
   building or enabling checkout. If the payout rail fails in practice → Paddle
   via a superseding ADR.
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
   2e. **Agent onboarding** — (a)+(b) shipped (job H); (c) anonymous/claimable quickstart **live 2026-08-23 under
   ADR-008/009 with edge, origin, OTP claim and real Delivery production gates passed**. Account-first with email code remains available.
   For the record: (a) agent-assisted signup without a browser —
   `POST /v1/auth/request-code {email}` → emailed 6-digit code (Better Auth `emailOTP` plugin) →
   `POST /v1/auth/verify-code {email, code, key_name}` creates user+org if new and returns a `pb_live_` manage key
   the agent stores in `~/.config/postbag/credentials.json`; (b) an Agent Skill in-repo (`skills/postbag/SKILL.md`,
   installable with `npx skills add faahim/postbag`, discoverable at `/.well-known/skills/`), with the landing page
   offering "paste this to your agent"; (c) `POST /v1/public/sandboxes` (no auth) creates a 24-hour
   sandbox Form that stores but does not deliver, plus a `claim_url` that sign-in turns into a real
   organization — deliveries unlock after claim and Destination setup. Retention, exact-path edge rate limiting,
   trusted-origin client IPs, concurrency and end-to-end production delivery proof are recorded above.
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

## Operations

- **DB backups:** daily at 03:00 server time, kept 14 days, **on the same server** (Coolify backup schedule
  `3gwbwkbf1mhtbp3gxwd9zw5x` on Postgres `fmeduf0fi7ax0dvsdhsvtewb`, created 2026-08-21). Off-server copies are
  not configured yet: add a Cloudflare R2 (S3-compatible) bucket as a Coolify S3 storage and flip `save_s3` — do this
  before the first paying customer.
- **Edge caching (2026-08-21):** Cloudflare Cache Rule "Cache marketing site at the edge" on postbag.dev — eligible for
  cache when host = postbag.dev and path not under `/app`, `/v1`, `/s/`, `/api/`, not `/health`, and the request does
  **not** send `Accept: text/markdown` (so agent negotiation never hits a cached HTML object); Edge TTL = respect origin
  `cache-control`. Origin sends `public, max-age=300, s-maxage=600, stale-while-revalidate=86400` for pages/markdown/llms.txt,
  immutable for `/_astro/*`, 7 d for images/fonts. Smart Tiered Cache on; Browser Cache TTL = Respect Existing Headers
  (was 4 h). Deploys propagate within ≤10 min without purging. Verified: `/` and `/pricing/` HIT on second request;
  `/v1/*`, `/app/*`, `/s/*`, markdown requests DYNAMIC. Zone SSL mode is Full (strict) (Fahim, 2026-08-21).
- No uptime monitor yet (`/health` is the probe to use).
- **EU cut-over verified 2026-08-21 16:20 UTC:** Let's Encrypt certs issued on dekhval-1 for all four hostnames (Traefik
  needed an app restart to retry ACME after the DNS flip); `postbag.withfaahim.com` back to 200. Gotcha: dekhval-1 throttles
  SSH after a burst of sessions — batch commands into one session.
- **Google consent screen** links `/legal/privacy/` + `/legal/terms/`; Google asks for "branding verification" (Search
  Console proof of postbag.dev) before showing the app name instead of the domain — do together with the Search Console
  - IndexNow item (DNS TXT verification; Fahim's Google login in the browser).
- **hello@postbag.dev** → Cloudflare Email Routing rule → afiur.fahim@gmail.com (set up 2026-08-21 in the Cloudflare
  dashboard; the API token in `~/Developer/smedja/.env` has no Email Routing scope). Apex MX records are Cloudflare's;
  Resend sends from `send.postbag.dev`, so they don't collide.
- **Legal identity (job I):** operator Md Afiur Rahman, trading as Postbag, Dhaka 1209, Bangladesh, hello@postbag.dev;
  governing law Bangladesh. Production is in **Germany** (Hetzner, `dekhval-1`) since 2026-08-21 16:04 UTC; the legal pages say so.

## Gotchas learned

- **Email identity is mailbox identity, not string identity.** Invitation accept compares with `sameMailbox()`
  (`packages/core/src/email.ts`): case/whitespace folded, `+tag` stripped everywhere, dots ignored on
  gmail.com/googlemail.com only. Found when Fahim was invited as `afiurfahim@gmail.com` but signed in as
  `afiur.fahim@gmail.com` (2026-08-22). Never rewrite addresses for _sending_, only for comparison.

- pnpm 11: build-script approval lives in `pnpm-workspace.yaml` under `allowBuilds:` (not `package.json.pnpm`).
- Local dev Postgres: `docker compose up -d db` → `postgres://postbag:postbag@localhost:5433/postbag` (OrbStack). To reset it, drop **both** `public` and `drizzle` schemas (drizzle tracks applied migrations in `drizzle.__drizzle_migrations`) and `drop role postbag_app`.
- `pnpm lint` builds core+db first (typed linting needs their d.ts); config files are excluded from typed rules.

- `source ~/Developer/smedja/.env` breaks in bash (an unquoted value on line 11); read vars with
  `grep '^NAME=' | cut -d= -f2-` instead.
- Coolify's `/api/v1/sources` does not exist; GitHub App uuids come from the Coolify DB on
  kolkobja: `docker exec coolify-db psql -U coolify -d coolify -c 'select id,uuid,name from github_apps'`.
- Coolify builds on the target server → images are arm64 on megh-oracle. Use multi-arch base images only.
