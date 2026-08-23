# Brand-overhaul clone-fidelity review

**Reviewer:** independent read-only fidelity review  
**Branch reviewed:** `codex/brand-overhaul`  
**Commit range inspected:** `1b8a741..7e65621` (plus current uncommitted final-QA evidence)  
**Recommendation:** **REQUEST_CHANGES**

## Scope and method

I treated prior claims and saved screenshots as untrusted. I inspected the committed
component tree, token sources, public assets/metadata, generated social previews,
current browser render at desktop/tablet/mobile, and the current final-QA artifacts.

The review specifically checked that the work is a live component system rather than
a screenshot substitute, that it uses shared semantic design tokens, and that the
receiving/routing family is applied across site, docs, and product surfaces.

## What is sound

- The homepage hero remains live DOM over a separate raster art layer; headline,
  actions, copy success state, navigation, and motion are all real interactive
  elements. The raster assets are supporting scene art, not a pasted UI.
- The design system has real, shared tokens for ink, indigo, periwinkle, Form white,
  shadows, typography, and motion in `apps/site/src/styles/global.css` and
  `apps/web/src/styles/tokens.css`.
- The old circular check/postmark component is gone from runtime consumers. The new
  `RoutingMark` is a reusable live SVG primitive used in both the marketing site and
  web app; ordinary copied/selection checks remain ordinary Lucide feedback rather
  than branded status badges.
- The social asset is integrated into five generated OG outputs rather than being a
  page screenshot. `apps/site/scripts/generate-social-assets.mjs` deterministically
  produces the social family from the tracked visual field.
- Browser inspection of the built site at `1440x1000`, `900x1000`, and `390x844`
  showed a coherent responsive system. The mobile menu opened as a full-height
  environment, locked document scrolling, moved focus into the dialog, and closed
  with Escape while returning focus to its trigger.
- A clean `pnpm --filter @postbag/site build` passed. The browser pass used the
  resulting static preview because the pre-existing dev server on port 4323 had a
  stale Astro cache error after scroll; that server issue is not reproduced by the
  production build.

## Findings

### CRITICAL

None.

### HIGH

1. **The site still hardcodes component-level transition durations despite having a
   shared motion scale.** This directly violates the required token-driven styling
   rule and makes the identity coat only partially systematic. Replace literal
   Tailwind duration utilities with the established motion token aliases (for
   example `duration-(--duration-quick)` or `duration-(--duration-fast)`).

   - `apps/site/src/components/ContactForm.astro:8` — `duration-150`
   - `apps/site/src/components/PricingNotify.astro:10` — `duration-150`
   - `apps/site/src/components/CodeBlock.astro:16` — `duration-150`
   - `apps/site/src/components/Faq.astro:13` — `duration-300`
   - `apps/site/src/layouts/LegalLayout.astro:34` and `:61` — `duration-150`

   The token definitions are already present at
   `apps/site/src/styles/global.css:51-60`, so this is a contained consistency fix,
   not an argument for adding another abstraction.

2. **The fixed Stream vocabulary is still contradicted by a user-reachable product
   route and the corresponding component tree.** The navigation visibly labels the
   destination “Streams” while sending users to `/bags`; the active route, schema,
   imports, and supporting diagram retain `Bag` / `bucket` terminology. The project
   contract requires fixed vocabulary in code, docs, and copy, and the updated brand
   source of truth repeats that requirement. Either migrate this legacy route and
   symbols to Streams (with compatibility redirects if needed), or document and
   isolate the legacy path as a compatibility exception. As it stands it leaves an
   old product concept under the new identity.

   - `apps/web/src/lib/nav.ts:12` — “Streams” points to `/bags`
   - `apps/web/src/routes/_app/bags/index.tsx:9`, `:21`, `:23`, `:27`, `:53` —
     `BagExplainer`, `createBagSchema`, and `BagsIndexRoute` remain active
   - `apps/web/src/components/bag-explainer.tsx:9-16` — the live Stream visual is
     described as a “bucket” and uses `bag-*` styling hooks

### MEDIUM

1. **A separate visible postage/stamp brand motif survives in the VIP badge.** It is
   not the removed check/postmark component, but it is another old postal-brand
   treatment that conflicts with the new guidance to avoid postal costumes and to
   keep supporting marks in the receiving/routing family. Rework it as a quiet
   periwinkle plan indicator (or ordinary interface treatment) and remove the
   “postage prepaid” copy.

   - `apps/web/src/components/vip-badge.tsx:1`, `:7-13`, `:29-30`

### LOW

1. Historical implementation material still tells future readers to use the retired
   red postmark / wax-seal identity. It is not a shipped customer surface, but it is
   searchable project guidance and can reintroduce the old system in later work.

   - `tasks/job-C-dashboard.md:44-52`
   - `PROGRESS.md:121-125`

## Evidence inspected

- Source and design contract: `docs/BRAND.md`, `docs/DESIGN.md`, site and web token
  files, `RoutingMark` components, Base/manifest/SEO sources, all branding commits
  from `1b8a741` through `7e65621`.
- Live built site: locally previewed site build at desktop (`1280x720`), tablet
  (`900x1000`), and mobile (`390x844`). Inspected homepage, mobile menu + Escape
  behavior, docs quickstart, and a light pricing page.
- Current generated/public assets: `apps/site/public/brand/social-routing-field-v1.webp`,
  `apps/site/public/og/default.png`, favicon/logo/manifest assets, and the generator
  script.
- Existing final-QA visual artifacts: `.omo/evidence/final-manual-qa/agents-desktop-1440x1000.png`,
  `compare-formspree-mobile-390x844.png`, `docs-mobile-390x844.png`,
  `pricing-tablet-834x1112.png`, and `sign-in-desktop-1440x1000.png`.
- Public-fact spot checks: `https://postbag.dev/` resolves successfully; the GitHub
  repository is public and AGPL-3.0; `postbag`, `@postbag/sdk`, and `@postbag/mcp`
  are published on npm.

## Required resolution before approval

Resolve both HIGH findings, rerun the affected browser/check suite, and provide fresh
evidence from a non-stale development or production-build server. The rest of the
identity is structurally strong enough for approval once those systemic inconsistencies
are removed.
