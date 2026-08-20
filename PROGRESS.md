# PROGRESS — the live blueprint

**Purpose:** if a session dies, the next one (human or agent) reads this file and
continues without reinventing. Keep it current; commit and push it with every
meaningful step. Newest entries at the top of each section. See `CLAUDE.md` for
the rules and `docs/` for the design.

## Current state (update this block, don't append)

- **Phase:** 1 — scaffolding + deploy pipeline (started 2026-08-21 night, autonomous run)
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
- **Implementation engine:** Codex via the `conduct` skill (`~/.claude/skills/conduct/SKILL.md`),
  `--effort xhigh`, one job per bounded spec; Claude writes specs, reviews, commits.
  Sonnet sub-agents are the fallback.

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

## In progress

- [x] Coolify application + Postgres resource created and wired (see Current state)
- [x] Placeholder Dockerfile deployed → `https://postbag.withfaahim.com/health` = 200 (deployment `podwf2dxeqjf8s0xtp0vpk0i`, 2026-08-21). Pipeline proven: GitHub → Coolify → Traefik → Cloudflare.
- [ ] Codex job A (`task-mt1zc0au-vw6k5m`, spec `tasks/job-A-scaffold.md`): monorepo scaffold + `packages/db` + `packages/core` + `packages/auth` — running since ~22:30 UTC 2026-08-21
- [ ] Codex job B (spec `tasks/job-B-server.md`, launches after A): `apps/server` submit path + worker + `/v1` API + auth + real Dockerfile

## Next up (in order)

1. Real Dockerfile replaces placeholder; Coolify redeploys from push; `/health` reports db + worker.
2. Destinations email/telegram/webhook + `/v1/quickstart` + `llms.txt`.
3. Dashboard SPA (shadcn, identity coat per `docs/DESIGN.md`): login, forms, inbox.
4. CLI + MCP thin clients.
5. Dogfood: portfolio contact form.

## Gotchas learned

- `source ~/Developer/smedja/.env` breaks in bash (an unquoted value on line 11); read vars with
  `grep '^NAME=' | cut -d= -f2-` instead.
- Coolify's `/api/v1/sources` does not exist; GitHub App uuids come from the Coolify DB on
  kolkobja: `docker exec coolify-db psql -U coolify -d coolify -c 'select id,uuid,name from github_apps'`.
- Coolify builds on the target server → images are arm64 on megh-oracle. Use multi-arch base images only.
