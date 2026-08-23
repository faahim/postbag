# Texture-system clone-fidelity review

**Reviewer:** independent, read-only design-system fidelity review

**Scope:** current uncommitted texture-system diff on `codex/brand-overhaul`
**Recommendation:** **APPROVE**

## Goal and decision standard

The requested system must make restrained material texture part of the shared
Postbag canvas across marketing, documentation, authentication, and product
without substituting live UI with a raster screenshot, making the approved hero
depend on the new effect, or putting texture over inputs, code, payloads, and
dense tables.

I treated earlier screenshots and success claims as untrusted. This report is
based on the current uncommitted diff, current token/component sources, the
current duplicate public assets, and fresh local rendered checks.

## What is structurally sound

- This is a genuine system layer, not a faked page or screenshot. The only new
  raster is a 640 x 640 static WebP material tile; it is referenced by semantic
  CSS variables and sits behind live DOM. The homepage’s visual remains its
  existing separate hero scene; its text, controls, navigation, and copy state
  remain live elements.
- Both independently built applications use the same token names: the site
  defines its canvas tokens in `apps/site/src/styles/global.css:46-49` and the
  dashboard defines the matching values in `apps/web/src/styles/tokens.css:53-57`.
  Light and dark modes tune only the intended opacity/blend tokens.
- The verified asset copies are byte-identical (`SHA-256
  6c609cd930607fad7a60e9073993afca715215b1898bd43c249b7db22d2466b0`),
  640 x 640 WebP, 40 KiB each. The asset is restrained material texture, not a
  rendered application surface.
- The site now gives `main`, footer, header, and the skip link an explicit layer
  above the fixed body texture (`apps/site/src/styles/global.css:180-195`). Its
  local ink/panel texture primitives create isolated contexts and place their
  own grain behind their live children (`apps/site/src/styles/global.css:221-249`).
  This resolves the earlier failure in which site grain could compose over code,
  inputs, and table planes.
- The dashboard has the same deterministic composition: the global grain is
  below `#root` (`apps/web/src/styles/index.css:76-93`), while the authentication
  ink canvas keeps its texture behind the live brand/copy tree
  (`apps/web/src/styles/index.css:119-135`). Opaque cards, inputs, dialogs,
  payloads, and tables therefore remain normal working planes.
- The pattern is actually consumed by shared page-family surfaces rather than
  bolted only onto the homepage: global site canvas (marketing and docs),
  `PageHeader` (`apps/site/src/components/PageHeader.astro:8`), `Footer`
  (`apps/site/src/components/Footer.astro:48`), the dashboard shell through
  `#root`, and `AuthSplitLayout` (`apps/web/src/components/auth-split-layout.tsx:7-50`).

## Fresh rendered evidence

- `http://127.0.0.1:4323/pricing/` at **1440 x 1000**: the dark public canvas,
  page header, plan ledger, and pricing control are live DOM above the fixed
  grain. The control and plan rows retain opaque tokenized backgrounds; no
  texture compositing crosses their content layer.
- `http://127.0.0.1:4323/docs/quickstart/` at **1440 x 1000**: the docs canvas
  has quiet material variation in its breathing room, while the `pre` panel
  remains an opaque surface above the global texture. Computed layers confirm
  `#main` is `position: relative; z-index: 1` and the body grain is `z-index: 0`.
- `http://127.0.0.1:5173/app/sign-in` at **1440 x 1000**: the app resolves the
  asset under its `/app/` base path, has global grain below `#root`, and renders
  the brand-ink auth environment through a local isolated texture plane at
  `z-index: -1`. The login fields remain clear and readable.
- The approval-bar homepage was re-opened at **1440 x 1000** after the stacking
  correction. The hero retains its independent receiving-pocket scene and live
  message/action structure; the new global material plane no longer blends over
  it.

`git diff --check` passes. The browser session subsequently refused another
navigation under its URL policy, so no post-correction mobile capture is claimed
here. The final change is static, fixed-position, pointer-inert CSS with no
viewport-specific branch; the existing responsive composition is not replaced.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

None.

## Residual verification note

The two public copies are intentionally needed because Astro and Vite have
separate public roots. They are byte-identical in the reviewed worktree. Keep
them synchronized if the grain is regenerated in a later identity pass.

## Conclusion

The texture implementation is a reusable, token-driven canvas treatment rather
than a pasted visual. It now meets the intended hierarchy: quiet materiality is
available throughout the brand, while the approved hero and dense working
surfaces remain independent, live, and legible. No blocker remains for this
texture-system batch.
