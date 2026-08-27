# Postbag manual QA matrix

Run date: 2026-08-24 (Asia/Dhaka). Browser surface: Codex in-app browser. Site invocation: `http://127.0.0.1:4323`. Product invocation: `http://127.0.0.1:5173`. The current rendered worktree was rechecked after the late visual and Streams changes; no source files were modified by this QA pass.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| QA2-HOME-DESKTOP | BRAND-1, RESPONSIVE-1 | Marketing homepage | Open `http://127.0.0.1:4323/` at 1440x1000; wait 1s; inspect headings, document width, and browser logs; capture settled screenshot | PASS | A1, A16 |
| QA2-HOME-COPY | INTERACTION-1 | Homepage hero prompt | On homepage, click `locator("#agent-prompt")`; inspect button text after 150ms and capture the Copied state | PASS | A2 |
| QA2-HOME-MENU | BRAND-2, A11Y-1 | Homepage mobile overlay | Set 390x844; open `button[aria-label="Open menu"]`; inspect dialog/focus/body overflow; press Escape; re-read fresh dialog state and focus | PASS | A3, A16 |
| QA2-FEATURES-DESKTOP | BRAND-3, RESPONSIVE-1 | Features page | Open `http://127.0.0.1:4323/features/` at 1440x1000; inspect rendered heading, document width and browser logs | PASS | A4, A16 |
| QA2-FEATURES-MOBILE | BRAND-3, RESPONSIVE-3 | Features page | Open `/features/` at 390x844; inspect mobile composition and document width; capture settled screenshot | PASS | A5, A16 |
| QA2-FEATURES-MENU | BRAND-2, A11Y-1 | Features light-page overlay | At 390x844 open the same menu; inspect `overflow=hidden`, focus `Menu`, then Escape and verify fresh dialog `aria-hidden=true` and focus `Open menu` | PASS | A6, A16 |
| QA2-AGENTS | BRAND-3, COPY-1 | For AI agents page | Open `/for-ai-agents/` at 1440x1000; inspect create/prove/claim/route headings and browser logs | PASS | A7, A16 |
| QA2-PRICING | BRAND-3, RESPONSIVE-2 | Pricing page | Open `/pricing/` at 834x1112; click `getByRole("tab", {name:"Yearly"})`; verify `aria-selected=true` and Pro/Team URLs contain `interval=year` | PASS | A8, A16 |
| QA2-COMPARE | BRAND-3, RESPONSIVE-3 | Compare/Formspree page | Open `/compare/formspree/` at 390x844; inspect document width and bounded `.compare-table-wrap` overflow region | PASS | A9, A16 |
| QA2-DOCS | BRAND-4, RESPONSIVE-3 | Documentation shell | Open `/docs/` at 390x844; inspect agent-first headings, document width and browser logs | PASS | A10, A16 |
| QA2-SIGNIN | BRAND-5, RESPONSIVE-1 | Product sign-in | Open `http://127.0.0.1:5173/app/sign-in` at 1440x1000; inspect brand panel, Form vocabulary, fields and CTA | PASS | A11, A16 |
| QA2-CLAIM-EMPTY | BRAND-5, INTERACTION-4 | Product claim empty state | Open `http://127.0.0.1:5173/app/claim` at 1024x900 without token; click `button[aria-label="Go to Postbag"]`; verify navigation to `/app/sign-in` | PASS | A12, A16 |
| QA2-STREAMS-GUARD | BRAND-5, VOCAB-1 | Product Streams route | Open `http://127.0.0.1:5173/app/streams` without authenticated session; verify branded sign-in redirect includes `redirect=%2Fstreams` | PASS | A13, A16 |
| QA2-BAGS-COMPAT | VOCAB-1, COMPAT-1 | Legacy Bags route | Open `http://127.0.0.1:5173/app/bags` without authenticated session; verify it resolves through the auth/Stream compatibility path rather than a 404 | PASS | A13, A16 |
| QA2-SIGNUP | BRAND-5, RESPONSIVE-2 | Product sign-up | Open `http://127.0.0.1:5173/app/sign-up` at 834x1112; wait 1200ms; inspect visible actionable controls | FAIL — hosted provider controls and email account-creation form are absent; only Sign in is actionable | A14, A16 |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV2-OVERFLOW-MOBILE | RESPONSIVE-1, RESPONSIVE-3 | narrow viewport | Public pages should keep document/client width at the viewport; intentional compare table overflow must remain inside its bounded wrapper | PASS | A5, A9, A10, A16 |
| ADV2-NAV-HERO | BRAND-2, A11Y-1 | mobile overlay over composed hero | Drawer should become full-height, lock body scroll, take focus, and close on Escape with focus restoration | PASS | A3, A16 |
| ADV2-NAV-LIGHT | BRAND-2, A11Y-1 | mobile overlay over light internal page | Same drawer behavior should work after a clean features-page load | PASS | A6, A16 |
| ADV2-COPY | INTERACTION-1 | repeated/copy feedback | Copy prompt should settle to a stable Copied label without layout-jitter evidence | PASS | A2 |
| ADV2-BILLING | INTERACTION-3 | alternate pricing state | Yearly selection must update selected state and checkout interval consistently | PASS | A8, A16 |
| ADV2-CLAIM-MISSING | BRAND-5 | incomplete deep link | Missing token must explain recovery and provide a working sign-in path | PASS | A12, A16 |
| ADV2-LEGACY-BAGS | VOCAB-1, COMPAT-1 | stale route/old vocabulary | `/app/bags` should not dead-end; it should resolve through the Stream compatibility/auth path | PASS | A13, A16 |
| ADV2-SIGNUP-PROVIDER | BRAND-5 | missing auth-provider prerequisite | Sign-up should expose Google/GitHub or email account creation, or report a precise actionable unavailable state | FAIL — no provider controls or account-creation form appeared after the configured-options request; missing prerequisite is the local auth-provider configuration | A14, A16 |
| ADV2-AUTH-STREAM-DATA | BRAND-5 | authenticated product state | Authenticated Stream list/detail and successful claim should be testable with a disposable account and valid token | FAIL — blocked by missing disposable authenticated session and valid claim token; unauthenticated redirect was verified, but the authenticated state was not fabricated | A12, A13, A16 |
| ADV2-REDUCED-MOTION | INTERACTION-2 | reduced-motion preference | Browser should emulate reduced motion and show transition guards | BLOCKED — this browser exposes no reduced-motion emulation capability; source/CSS guard audit is outside this rendered runtime case | A16 |
| ADV2-CONSOLE | RESPONSIVE-4 | runtime error surface | Tested settled routes should emit no product warning/error logs | PASS | A16 |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| A1 | screenshot | Current homepage hero, 1440x1000 | `.omo/evidence/final-manual-qa-2/current-home-desktop-1440x1000.png` |
| A2 | screenshot | Homepage prompt Copied state, 1440x1000 | `.omo/evidence/final-manual-qa-2/home-copy-success-1440x1000.png` |
| A3 | screenshot | Current homepage mobile drawer, 390x844 | `.omo/evidence/final-manual-qa-2/current-home-mobile-menu-390x844.png` |
| A4 | screenshot | Current features page desktop, 1440x1000 | `.omo/evidence/final-manual-qa-2/current-features-desktop-1440x1000.png` |
| A5 | screenshot | Current features page mobile, 390x844 | `.omo/evidence/final-manual-qa-2/current-features-mobile-390x844.png` |
| A6 | screenshot | Current features light-page mobile drawer, 390x844 | `.omo/evidence/final-manual-qa-2/current-features-mobile-menu-390x844.png` |
| A7 | screenshot | Current For AI agents page, 1440x1000 | `.omo/evidence/final-manual-qa-2/current-agents-desktop-1440x1000.png` |
| A8 | screenshot | Current pricing yearly state, 834x1112 | `.omo/evidence/final-manual-qa-2/current-pricing-yearly-834x1112.png` |
| A9 | screenshot | Current compare/Formspree page mobile, 390x844 | `.omo/evidence/final-manual-qa-2/current-compare-mobile-390x844.png` |
| A10 | screenshot | Current docs shell mobile, 390x844 | `.omo/evidence/final-manual-qa-2/current-docs-mobile-390x844.png` |
| A11 | screenshot | Current product sign-in, 1440x1000 | `.omo/evidence/final-manual-qa-2/current-product-sign-in-desktop-1440x1000.png` |
| A12 | screenshot | Current claim empty state, 1024x900 | `.omo/evidence/final-manual-qa-2/current-product-claim-empty-1024x900.png` |
| A13 | screenshot | Current unauthenticated Streams/Bags guard result, 1440x1000 | `.omo/evidence/final-manual-qa-2/current-streams-desktop-1440x1000.png` |
| A14 | screenshot | Current sign-up tablet with missing provider controls, 834x1112 | `.omo/evidence/final-manual-qa-2/current-product-sign-up-tablet-834x1112.png` |
| A16 | transcript | Exact invocations, rendered states, viewport widths, overflow checks, console results, and limits | `.omo/evidence/final-manual-qa-2/current-browser-observations.md` |

## Verdict

Runnable marketing, navigation, pricing, docs, auth sign-in, claim-empty, and Streams/Bags guard scenarios passed with clean browser warning/error logs and no document-level mobile overflow. The matrix is not fully green because local sign-up provider controls are unavailable, authenticated Stream/claim states require a disposable session/token, and reduced-motion emulation is unavailable in this browser. Those are recorded as concrete failures/limits rather than inferred passes.
