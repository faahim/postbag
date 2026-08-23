# Product brand surfaces browser QA

Date: 2026-08-24
Local preview: `http://127.0.0.1:5173/app/`

## Desktop sign-in

- Invocation: in-app browser at 1440 x 1000, `/app/sign-in`
- Observable: permanent dark-token brand panel and themed form panel both rendered; heading, labels, fields, submit button, and account link present in the accessibility tree.
- Overflow: layout bounds were 1440 px wide; aside 756 px and main 684 px.
- Artifact: `sign-in-desktop-1440x1000.png`

## Tablet sign-up

- Invocation: in-app browser at 900 x 1000, `/app/sign-up`
- Observable: compact Postbag identity header and single-column auth composition rendered; no desktop aside at the sub-`lg` breakpoint.
- Artifact: `sign-up-tablet-900x1000.png`
- Limit: provider discovery remained in its loading skeleton because the standalone Vite preview had no local API server.

## Mobile sign-in validation

- Invocation: in-app browser at 390 x 844, `/app/sign-in`, activate `Sign in` with empty fields.
- Observable: email and password validation messages rendered, focus moved to Email, and the controls stayed within the viewport.
- Overflow: `scrollWidth` 390 equals `innerWidth` 390.
- Artifact: `sign-in-mobile-validation-390x844.png`

## Claim error state

- Invocation: in-app browser at 1024 x 900, `/app/claim` without a token.
- Observable: settled incomplete-link state rendered with semantic destructive icon, direct recovery copy, and `Go to Postbag` action.
- Overflow: `scrollWidth` 1024 equals `innerWidth` 1024.
- Artifact: `claim-incomplete-1024x900.png`

## Reduced motion

- Observable: no automatic motion was added to auth or claim. The only retained loading/reveal animations use existing global motion utilities, and `tokens.css` applies the repository-wide `prefers-reduced-motion: reduce` override to animations and transitions.

## Authenticated-state limit

- The first-run result and valid sandbox claim states require an authenticated local API session and seeded sandbox token. They were typechecked, linted, tested, and built, but were not fabricated in browser QA.
