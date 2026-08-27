# Compare family verification evidence

Scope: `apps/site/src/pages/compare/index.astro` and `apps/site/src/pages/compare/[slug].astro` only. Competitor facts, sources, dates, slugs, SEO fields, and table semantics remain data-driven from `apps/site/src/content/compare.ts`.

## 1. Type and static-site generation

- Scenario: compile every marketing route, including the comparison index and all six static comparison details.
- Invocation: `pnpm --filter @postbag/site typecheck`
- Binary observable: Astro reported `0 errors`, `0 warnings`, and only the pre-existing `Base.astro` inline-script hint.
- Invocation: `pnpm --filter @postbag/site build`
- Binary observable: build completed successfully, generated `/compare/index.html` and six `/compare/{slug}/index.html` routes, then completed the postbuild clean step. The final run built 83 pages.

## 2. Desktop index composition

- Scenario: comparison index at 1440 x 1000, dark system theme.
- Invocation: local Astro server at `http://192.168.0.162:4330/compare/`, inspected with the in-app browser.
- Binary observable: title was `Compare form backends | Postbag`; six `.compare-link` entries rendered; document and body widths were both 1440 px. The only wider internal element was the intentionally clipped PageHeader decorative treatment, while the page itself had no horizontal scroll.
- Artifact: `compare-index-desktop-viewport.png`.

## 3. Tablet index composition

- Scenario: comparison index at 1024 x 900.
- Invocation: local Astro server at `http://192.168.0.162:4330/compare/`, inspected with the in-app browser.
- Binary observable: six comparison links rendered, first link resolved to `/compare/formspree/`, heading rendered as `A form is only the beginning.`, and body/client widths both measured 1024 px.
- Artifact: `compare-index-tablet-viewport.png`.

## 4. Desktop comparison detail, sources, and semantics

- Scenario: Formspree detail at 1440 x 1000.
- Invocation: local Astro server at `http://192.168.0.162:4330/compare/formspree/`, inspected with the in-app browser.
- Binary observable: route and title resolved to the Formspree comparison; all 12 table rows rendered; accessible caption was `Capability comparison between Postbag and Formspree`; three vendor source links rendered; and page horizontal overflow was false.
- Artifact: `compare-formspree-desktop-viewport.png`.

## 5. Mobile table behavior

- Scenario: Formspree detail at 390 x 844, then horizontal scroll inside the comparison table.
- Invocation: local Astro server at `http://192.168.0.162:4330/compare/formspree/`, inspected and scrolled with the in-app browser.
- Binary observable: page body/client widths both measured 390 px; the mobile scroll instruction was visible; table viewport measured 350 px against 752 px of table content; a real horizontal scroll moved the table `scrollLeft` from 0 to 300 px without causing page-level horizontal overflow.
- Artifacts: `compare-formspree-mobile-viewport.png` and `compare-formspree-mobile-table-scrolled.png`.

## Interaction/QA boundary

The actual mobile table scroll was exercised. The in-app browser allowed direct local-route rendering but blocked a Playwright click from the index to the detail route under its private-network URL policy; the anchor's visible `href` was verified as `/compare/formspree/`, and the destination was rendered separately. This is a browser-automation policy limit, not a route or build failure.

Reduced-motion guards are present in both changed pages for their added hover transitions. The browser surface did not expose media emulation, so a live reduced-motion OS setting was not fabricated as verified.
