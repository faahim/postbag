# Fresh browser observations after late brand/Streams fixes

Run: 2026-08-24, Codex in-app browser, local servers `4323` (site) and `5173` (product). These observations are from the current rendered worktree after the late uncommitted fixes were visible in the dev servers.

## Marketing

- `http://127.0.0.1:4323/` at `1440x1000`: title `Postbag: your forms have somewhere to go`; hero and below-hero headings rendered; `scrollHeight=10463`, `clientWidth=1440`; browser warning/error log empty. Screenshot: `current-home-desktop-1440x1000.png`.
- `http://127.0.0.1:4323/features/` at `1440x1000`: title `Features | Postbag`; heading `One calm place to receive. A clear route onward.`; `scrollHeight=5311`, `clientWidth=1440`; browser warning/error log empty. Screenshot: `current-features-desktop-1440x1000.png`.
- `http://127.0.0.1:4323/features/` at `390x844`: same feature narrative rendered with mobile composition; `scrollHeight=6012`, `clientWidth=390`; browser warning/error log empty. Screenshot: `current-features-mobile-390x844.png`.
- `http://127.0.0.1:4323/for-ai-agents/` at `1440x1000`: agent-native sandbox/create/prove/claim/route narrative rendered; `clientWidth=1440`; browser warning/error log empty. Screenshot: `current-agents-desktop-1440x1000.png`.
- `http://127.0.0.1:4323/pricing/` at `834x1112`: monthly and yearly plans rendered; `clientWidth=834`; yearly tab set `aria-selected=true`, and Pro/Team links changed to `interval=year`. Screenshot: `current-pricing-yearly-834x1112.png`.
- `http://127.0.0.1:4323/compare/formspree/` at `390x844`: comparison page rendered at viewport width; the bounded `.compare-table-wrap` is the intentional horizontal-scroll region; browser warning/error log empty. Screenshot: `current-compare-mobile-390x844.png`.
- `http://127.0.0.1:4323/docs/` at `390x844`: docs shell rendered with agent-first entry points; `clientWidth=390`; browser warning/error log empty. Screenshot: `current-docs-mobile-390x844.png`.

## Navigation interaction

- Homepage hero at `390x844`: exact invocation was open `button[aria-label="Open menu"]`, inspect `role=dialog`, then press `Escape`; open state had `role=dialog` visible, active element `Menu`, and body `overflow=hidden`. After Escape, a fresh `[role=dialog]` read returned `aria-hidden=true`, body `overflow=clip visible`, and focus `Open menu`. Screenshot: `current-home-mobile-menu-390x844.png`.
- Features light page at `390x844`: the same invocation and checks passed. Open state had active `Menu` and body `overflow=hidden`; after Escape, a fresh dialog read returned `aria-hidden=true`, body `overflow=clip visible`, and focus `Open menu`. Screenshot: `current-features-mobile-menu-390x844.png`.

## Product

- `http://127.0.0.1:5173/app/sign-in` at `1440x1000`: branded midnight auth panel, Form vocabulary, email/password fields, and Sign in CTA rendered; `scrollHeight=1000`, `clientWidth=1440`; browser warning/error log empty. Screenshot: `current-product-sign-in-desktop-1440x1000.png`.
- `http://127.0.0.1:5173/app/sign-up` at `834x1112`: branded copy rendered, but the configured-options request left only a Sign in link; no Google/GitHub controls or email account-creation form were present after 1200ms. Screenshot: `current-product-sign-up-tablet-834x1112.png`.
- `http://127.0.0.1:5173/app/claim` at `1024x900` without a token: `This claim link is incomplete` and recovery copy rendered. Clicking `button[aria-label="Go to Postbag"]` navigated to `http://127.0.0.1:5173/app/sign-in`. Screenshot: `current-product-claim-empty-1024x900.png`.
- `http://127.0.0.1:5173/app/streams` without an authenticated session redirected to branded sign-in with `?redirect=%2Fstreams`; browser warning/error log empty. Screenshot: `current-streams-desktop-1440x1000.png`.
- `http://127.0.0.1:5173/app/bags` without an authenticated session resolved through the compatibility/auth path to the same branded sign-in destination with `?redirect=%2Fstreams`; no 404 was observed. This confirms the legacy route is not a dead page, but an authenticated Stream list/detail state could not be exercised without a disposable account/session.

## Limits

- No disposable authenticated account or valid claim token was available, so authenticated Streams data, first-run dashboard, successful claim, and outbound delivery states were not fabricated.
- The browser capability did not expose `prefers-reduced-motion` emulation. Source/CSS reduced-motion guards were not re-proven through a runtime preference toggle in this pass.
