# PROGRESS — the live blueprint

**Purpose:** if a session dies, the next one (human or agent) reads this file and
continues without reinventing. Keep it current; commit and push it with every
meaningful step. Newest entries at the top of each section. See `CLAUDE.md` for
the rules and `docs/` for the design.

## Current state (update this block, don't append)

- **Phase:** 1 — MVP **live** (overnight autonomous run 2026-08-21; jobs A–E done). Remaining Phase 1 items are in *Next up*.
- **Repo:** `github.com/faahim/postbag` (private), default branch `main`
- **Deploy target:** Coolify (control plane `kolkobja.tarpore.com`) → server **megh-oracle**
  (`140.245.57.24`, arm64, uuid `a8w4s8cg0go4kwo0g0gk8co0`). Coolify project "Postbag".
- **Domain:** `postbag.withfaahim.com` → A record (proxied) → megh-oracle. Zone id
  `4f548539cadf02e52a52ef6957a82e3f`.
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

## Decisions made tonight (2026-08-21)

- UI label for `stream` = **Bag**. ("Collection" considered; Bag is on-brand and unambiguous.)
- ADR-003 accepted: dashboard = Vite + React SPA served by the API container.
  **Public/marketing pages are a separate Astro site** (SSR/SSG, SEO + GEO optimised) —
  `apps/site`, Phase 3. Nothing public-facing is rendered client-side.
- ADR-005 accepted: JSONata for mapping expressions, filters, transforms (Phase 2).
- Hosting: megh-oracle chosen over dekhval-1 (Hermes load) and kolkobja (control plane, low RAM).

## Done

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

## Next up (in order)

0. Design session with Fahim on the dashboard (see Job E verdict). Screenshots: session scratchpad `web-shots/` (before) and `web-shots-v2/` (after).
1. Wire RLS into the request path (`RLS_ENFORCED=true`: per-request transaction with `SET LOCAL ROLE postbag_app` + `set_config('app.org_id')`); then flip the default on. Sync `api/openapi.yaml` with the generated doc (new: `/v1/forms/{id}/schema/infer`, `/v1/webhooks/{id}/deliveries`, `SchemaVersion.inferred`).
2. CLI + MCP thin clients over `packages/sdk`.
3. Dogfood: portfolio contact form → Postbag. Then Smedja `forge` provisioning.
4. Marketing site (`apps/site`, Astro SSR, SEO+GEO) — Phase 3 but the domain decision (postbag.dev?) should happen earlier.

- **Email:** Resend account = the key in `~/Developer/vendingmachine-stuff/.env` (only account on disk;
  `updates.withfaahim.com` belongs to some other account). Sending domain
  **`postbag.withfaahim.com`** created in Resend (id `fda6ffab-c792-42f3-bc76-0e03fbd7e80b`,
  eu-west-1), DKIM/SPF/MX records added in Cloudflare 2026-08-21; `MAIL_FROM=Postbag <notify@postbag.withfaahim.com>`
  and `RESEND_API_KEY` set on the Coolify app.

## Gotchas learned

- pnpm 11: build-script approval lives in `pnpm-workspace.yaml` under `allowBuilds:` (not `package.json.pnpm`).
- Local dev Postgres: `docker compose up -d db` → `postgres://postbag:postbag@localhost:5433/postbag` (OrbStack). To reset it, drop **both** `public` and `drizzle` schemas (drizzle tracks applied migrations in `drizzle.__drizzle_migrations`) and `drop role postbag_app`.
- `pnpm lint` builds core+db first (typed linting needs their d.ts); config files are excluded from typed rules.

- `source ~/Developer/smedja/.env` breaks in bash (an unquoted value on line 11); read vars with
  `grep '^NAME=' | cut -d= -f2-` instead.
- Coolify's `/api/v1/sources` does not exist; GitHub App uuids come from the Coolify DB on
  kolkobja: `docker exec coolify-db psql -U coolify -d coolify -c 'select id,uuid,name from github_apps'`.
- Coolify builds on the target server → images are arm64 on megh-oracle. Use multi-arch base images only.
