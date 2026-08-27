# Postbag brand-overhaul manual QA

Date: 2026-08-27
Worktree: `/Users/faahim/Developer/postbag-brand-overhaul`
Branch: `codex/brand-overhaul`
QA mode: read-only browser and build verification

## Overall verdict

**APPROVE for the public brand release, with non-blocking watches.** No public
marketing, documentation, comparison, pricing, error, or auth-surface release
blocker was reproduced. The authenticated dashboard and provider-backed account
creation were not asserted because this run had no authenticated browser state
and the local server has no configured sign-up providers; those are environment
gates, not fabricated QA passes.

### Final delta verification

After the initial browser matrix, `62f02f1` rewrote the feature, use-case, and
comparison families into the marketing register and completed the mobile
drawer's modal isolation. A fresh Astro build still generated 83 pages. The
rewritten routing feature, agencies use case, and Formspree comparison were then
checked at 1440x1000 and 390x844: every page matched the viewport width with no
horizontal overflow. Opening the homepage drawer made `main` and `footer`
inert; Escape removed both attributes, unlocked the page, and returned focus to
the menu button. The final browser console had no warnings or errors.

## surfaceEvidence

| Scenario | Criterion | Surface | Exact invocation | Verdict | Artifact refs |
|---|---|---|---|---|---|
| SURF-001 | Public route availability | Static site route family | `pnpm --filter @postbag/site build`; then `GET` each path with `/usr/bin/curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:4323<path>` | PASS | ART-001, ART-002 |
| SURF-002 | Hero composition and brand surface | Homepage desktop and ultra-wide | Browser: `viewport.set({width:1440,height:1000})`; `goto('http://127.0.0.1:4323/')`; settled screenshot; repeated at `2048x1510` | PASS | ART-003, ART-004 |
| SURF-003 | Responsive detail layout | Six feature detail pages and five use-case detail pages | Browser loop over all paths in `detailSlugs` at `1440x1000`, `834x1112`, and `390x844`; measured `document.documentElement.scrollWidth`, headings, main/article widths | PASS | ART-005, ART-006, ART-007 |
| SURF-004 | Feature detail visual quality | `/features/routing/` at desktop, settled after 1.8s | Browser: `viewport.set({width:1440,height:1000})`; `goto('http://127.0.0.1:4323/features/routing/')`; wait 1800ms; screenshot | PASS | ART-008 |
| SURF-005 | Documentation shell and reading layout | `/docs/quickstart/` at desktop and mobile | Browser: `goto` at `1440x1000` and `390x844`; settled screenshots; DOM metrics | PASS | ART-009, ART-010 |
| SURF-006 | Documentation mobile navigation | `/docs/quickstart/` at `390x844` | Browser: click `button[aria-label="Open menu"]`; inspect open state; press `Escape`; inspect closed state | PASS | ART-010, ART-011 |
| SURF-007 | Pricing interaction | `/pricing/` at `834x1112` | Browser: `goto`; click role `tab` named `Yearly`; verify selected tab and `$12/$144`, `$39/$468`; open first FAQ `summary` | PASS | ART-012, ART-013 |
| SURF-008 | Comparison and API error responsive states | `/compare/formspree/` and `/docs/errors/not_found/` at `390x844` | Browser: `goto` each path; settled screenshots; inspect h1, table scroll container, and page overflow | PASS | ART-014, ART-015 |
| SURF-009 | Product auth boundary | `/app/sign-in/` at `1440x1000` and `390x844` on server port 5173 | Browser: `goto('http://127.0.0.1:5173/app/sign-in/')`; settled screenshots; inspect form, h1, inputs, and overflow | PASS | ART-016, ART-017 |
| SURF-010 | Product sign-up environment state | `/app/sign-up/` at `834x1112` | Browser: `goto('http://127.0.0.1:5173/app/sign-up/')`; wait 3.6s; inspect rendered message and overflow | WATCH | ART-018 |
| SURF-011 | Brand metadata and assets | Homepage rendered metadata and public asset endpoints | Browser evaluate canonical/OG/Twitter/icon/image state; `/usr/bin/curl` each favicon, icon, OG, hero, grain and mark URL | PASS | ART-019 |
| SURF-012 | Browser console | Homepage, feature, docs, compare, pricing, error and auth navigation session | Browser: `tab.dev.logs({levels:['error','warn'],limit:200})` after navigation suite | PASS | ART-020, ART-021 |
| SURF-013 | Product build gate | Dashboard bundle | `pnpm --filter @postbag/web typecheck && pnpm --filter @postbag/web build` | PASS | ART-022 |

The public route probe returned HTTP 200 for all listed marketing/docs paths;
an unknown `/definitely-missing/` returned HTTP 404 with title `Page not found |
Postbag`. The Astro build generated 83 pages. The browser metrics show
`scrollWidth === innerWidth` for all tested responsive surfaces.

## adversarialCases

| Scenario | Criterion | Adversarial class | Expected behavior | Verdict | Artifact refs |
|---|---|---|---|---|---|
| ADV-001 | Responsive integrity | Horizontal overflow at 390px, 834px, 1440px, and 2048px | No page-level horizontal overflow; contained comparison table may scroll inside its own parent | PASS | ART-004, ART-005, ART-006, ART-007, ART-014 |
| ADV-002 | Navigation safety | Mobile menu open, Escape close, focus return, scroll lock | Menu opens as a full-height surface, body locks, Escape closes, focus returns to opener | PASS | ART-011 |
| ADV-003 | Layout stability | Long feature/use-case headings | Headings remain readable and do not collapse into narrow one-word columns | PASS | ART-005, ART-006, ART-007, ART-008 |
| ADV-004 | Interaction state | Yearly pricing and FAQ disclosure | Selected tab updates prices and billing copy; FAQ disclosure opens without overflow | PASS | ART-013 |
| ADV-005 | Missing route/error state | Unknown route and API error reference | Unknown route returns branded 404; API error page exposes code, status, guidance and navigation | PASS | ART-015 |
| ADV-006 | Asset integrity | Missing favicon/OG/hero/grain asset | All requested public identity asset URLs return HTTP 200 with expected MIME types; rendered eager hero image is complete | PASS | ART-019 |
| ADV-007 | Browser runtime failures | Console errors/warnings during navigation suite | No console error or warning entries | PASS | ART-020, ART-021 |
| ADV-008 | Reduced motion | Motion-heavy hero/detail/menu surfaces | Reduced-motion CSS and script branches are present in source; runtime emulation was unavailable in the connected in-app browser | WATCH | ART-023 |
| ADV-009 | Authenticated product state | Signed-in dashboard screens | Use an existing authenticated state or mark unverified; never invent credentials/session | NOT_RUN — BLOCKED | ART-024 |
| ADV-010 | Provider-backed account creation | OAuth/password sign-up flow | Verify configured provider buttons or clearly expose environment limitation | WATCH | ART-018, ART-024 |

## Non-blocking watches and blockers

- The local sign-up page correctly explains that new hosted accounts use Google
  or GitHub, but this local server has no configured providers and no
  email-password sign-up capability. No account was created and no credentials
  were entered.
- The authenticated dashboard cannot be manually asserted in this run because
  no signed-in browser state was available. `/app/` correctly redirected to the
  public sign-in surface. This is a coverage limitation, not a reproduced
  branding defect.
- The connected browser exposed viewport control but no reduced-motion emulation
  capability. Source-level `prefers-reduced-motion` handling was confirmed;
  runtime reduced-motion behavior remains a follow-up if a browser with that
  emulation is available.
- Vite emitted its existing large-chunk warning during the product build. The
  build and typecheck completed successfully; this is not a brand-release gate.

## artifactRefs

| ID | Kind | Description | Path |
|---|---|---|---|
| ART-001 | build log | Fresh Astro static build output; 83 pages generated | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/standalone-pages/site-build.log` |
| ART-002 | route probe | Current-run route results are recorded in this matrix; unknown route separately checked as HTTP 404 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/brand-overhaul-manual-qa.md` |
| ART-003 | screenshot | Homepage desktop 1440x1000 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/home-desktop-1440x1000.png` |
| ART-004 | screenshot | Homepage ultra-wide 2048x1510 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/home-wide-2048x1510.png` |
| ART-005 | metrics | All feature/use-case detail desktop metrics | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/detail-desktop-metrics.json` |
| ART-006 | metrics | All feature/use-case detail tablet and mobile metrics | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/detail-responsive-metrics.json` |
| ART-007 | screenshot | Feature detail ultra-wide 2048x1510 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/feature-wide-2048x1510.png` |
| ART-008 | screenshot | Settled feature routing desktop 1440x1000 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/feature-routing-desktop-1440x1000-settled.png` |
| ART-009 | screenshot | Docs quickstart desktop 1440x1000 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/docs-quickstart-desktop-1440x1000.png` |
| ART-010 | screenshot | Docs quickstart mobile 390x844 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/docs-quickstart-mobile-390x844.png` |
| ART-011 | screenshot + interaction | Homepage mobile menu open and Escape/focus/scroll-lock result | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/home-mobile-menu-open-390x844.png` |
| ART-012 | screenshot | Pricing tablet initial state | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/pricing-tablet-834x1112.png` |
| ART-013 | screenshot + interaction | Pricing yearly state and FAQ disclosure result | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/pricing-yearly-tablet-834x1112.png` |
| ART-014 | screenshot | Formspree comparison mobile 390x844 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/compare-formspree-mobile-390x844.png` |
| ART-015 | screenshot | `not_found` API error mobile 390x844 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/docs-error-not-found-mobile-390x844.png` |
| ART-016 | screenshot | Product sign-in desktop 1440x1000 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/product-sign-in-desktop-1440x1000.png` |
| ART-017 | screenshot | Product sign-in mobile 390x844 | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/product-sign-in-mobile-390x844.png` |
| ART-018 | screenshot | Product sign-up settled tablet 834x1112 showing provider limitation | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/product-sign-up-tablet-settled-834x1112.png` |
| ART-019 | JSON + HTTP probe | Rendered metadata, icon links, image completion, and public asset HTTP 200 checks | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/brand-assets-metadata.json` |
| ART-020 | JSON | Marketing browser console warnings/errors (empty) | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/site-browser-console-warnings-errors.json` |
| ART-021 | JSON | Product browser console warnings/errors (empty) | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/browser-console-warnings-errors.json` |
| ART-022 | build output | Current-run web typecheck and production build completed successfully | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/brand-overhaul-manual-qa.md` |
| ART-023 | source audit | Reduced-motion branches found across site and web CSS/components | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/brand-overhaul-manual-qa.md` |
| ART-024 | boundary observation | `/app/` redirects to `/app/sign-in`; no authenticated state or credentials were used | `/Users/faahim/Developer/postbag-brand-overhaul/.omo/evidence/final-manual-qa-3/product-sign-in-desktop-1440x1000.png` |
