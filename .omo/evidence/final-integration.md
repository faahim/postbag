# Postbag brand overhaul — final integration evidence

Date: 2026-08-24
Branch: `codex/brand-overhaul`
Baseline: `1b8a741`

## Automated gates

- `pnpm lint` — pass
- `pnpm typecheck` — pass (0 errors, one existing Astro inline-script hint)
- `pnpm test` — pass, 38 files / 164 tests; 23 files / 144 tests intentionally skipped by the workspace configuration
- `pnpm --filter @postbag/site build` — pass, 83 pages
- `pnpm --filter @postbag/web build` — pass
- `pnpm --filter @postbag/site brand:social` — pass, five 1200×630 social images
- `git diff --check` — pass

## Integrated browser checks

Browser: Codex in-app browser against `http://127.0.0.1:4323` and `http://127.0.0.1:5173/app`.

- Homepage desktop 1440×1000: inspected settled hero, live Form integration, durable receipt, agent handoff, Stream topology, guarantees, Destinations, self-hosting, FAQ, CTA and footer; zero horizontal overflow.
- Marketing desktop 1440×1000: Features, For AI agents, Pricing, Compare, Use Cases and Docs; representative first folds inspected and zero horizontal overflow on every page.
- Homepage mobile 390×844: approved mobile composition intact; zero horizontal overflow.
- Mobile navigation: opened over the homepage and over Pricing in light theme; dialog focus, full-height composition, body scroll lock and Escape close verified.
- Product auth desktop 1440×1000: sign-in identity environment, periwinkle actions and fixed product vocabulary rendered without overflow.
- Additional delegated evidence covers 1440×1000, 1024×900, 900×1000/1100 and 390×844 page-family and auth scenarios.
- Fresh post-review evidence is recorded in `.omo/evidence/final-manual-qa-2/`; stale Astro-error and pre-token auth captures were removed.
- Features no longer embeds the retired dashboard raster. Its current live receiving/API scene was checked at 1440×1000 and 390×844.
- The dashboard now uses `/streams`; legacy `/bags` URLs are compatibility redirects, and both unauthenticated paths were exercised without a 404.

## Live truth checks

- GitHub repository visibility: `PUBLIC`, default branch `main`.
- npm: `postbag@0.1.0`, `@postbag/sdk@0.1.0`, `@postbag/mcp@0.1.1`.
- `https://postbag.dev/health`: HTTP 200, database up, worker alive.
- `https://postbag.dev/openapi.json`: HTTP 200 and `/v1/public/sandboxes` present.

## Limits

- The browser-control surface did not expose a media-preference override, so reduced-motion behavior is supported by explicit source guards and delegated source audit rather than a final emulated browser capture.
- Valid claim success and authenticated first-run were not fabricated without a disposable local account/token. Their components built and tested; incomplete claim and unauthenticated auth states have browser evidence.
- Local sign-up rendered the branded shell but no configured Google/GitHub controls or email creation form. This is recorded as a local-provider prerequisite failure, not an inferred pass.
- No production Form Submission, account, checkout, merge or deployment was performed.
