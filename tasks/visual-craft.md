# Visual craft backlog — marketing site

Source: full design audit of `apps/site` (2026-08-24), verified against
`docs/BRAND.md` / `docs/DESIGN.md`. Copy/voice work is **done** (commits
`99aeeb9`, `79cd758`); this file is the remaining pixels-and-motion work,
in recommended order. Line numbers are from the audit and may drift.

## 1. Reads-as-broken (fix first, one short session)

- [ ] **Fleet-map connectors look like empty cards.** `Operator.astro` —
  `.fleet-join` / `.fleet-split` (~:68-71) render as blank rectangles with a
  line at 1440px. Redraw as actual route traces (single stroked path /
  bracket without the boxed void), on-motif.
- [ ] **`text-destructive` has no token.** `RoutingMark.astro:13` uses it but
  `global.css` defines no `--destructive` / `--color-destructive`; the
  `dead` status silently renders in inherited color. Add the token (red is
  reserved for destructive semantics per BRAND).
- [ ] **Duplicate `.t-icon-swap` definition.** `global.css` ~:791-814 and
  ~:919-933; second copy hardcodes blur/scale so `--icon-swap-*` tokens are
  dead. Keep one, tokenized.
- [ ] **39 orphan error pages.** `pages/docs/errors/[code].astro` generated
  from `content/errors.ts`, in sitemap, linked from nowhere;
  `content/docs/errors.md` lists 16 codes unlinked. Either link them all
  from the errors doc or stop generating. (Pairs with §5 redesign.)
- [ ] **`PricingNotify.astro` is dead code.** Fully built waitlist flow,
  imported by nothing. Wire into `pricing.astro` or delete.
- [ ] **Hardcoded demo Form id fallback.** `Integration.astro:6` falls back
  to `"fm_73c74vjq6z24"` when `PUBLIC_DEMO_FORM_ID` is unset. Fail visible
  (render the static snippet variant) instead of posting to a stale id.

## 2. One type system (mechanical, big consistency payoff)

- [ ] **One `<Kicker>` component.** Ten incompatible eyebrow treatments:
  `PageHeader.astro:12`, `.hero-kicker` (global.css ~:673), `.docs-kicker`
  (DocsLayout ~:141), `.compare-kicker` (compare pages), `.section-label`
  (for-ai-agents ~:105 vs about ~:62 — nearly but not identical),
  `.control-label`/`.plan-index` (pricing), `.term-index` (glossary), plain
  sans variants (`features/index.astro:21,44,72`, `use-cases/index.astro:20`),
  sans-bold variants (feature/use-case detail asides), `.error-code`
  (404.astro:11). Replace all with one component + `tone` prop.
- [ ] **One H2 display ramp.** Six `clamp()` variants (3.7/3.65/3.5/3.4/3.35
  rem tops) across features/use-cases/compare/for-ai-agents/about; homepage
  mixes `text-6xl` and `text-5xl` H2s (Journey, Integration vs the rest);
  `Faq.astro:7` is smaller than its neighbours. Pick one scale, tokenize.
- [ ] **Display weight scale.** Per-file variable-font weights (520–650).
  Settle 2–3 named stops.
- [ ] **Radius literals.** `compare/[slug].astro` `1rem`/`0.25rem`,
  `pricing.astro` `99px` (vs `999px` elsewhere) — move onto the radius scale.
- [ ] **Stagger rhythm.** `data-reveal-group` values 70/80/90ms across pages
  + hardcoded `${index * 50}ms` in `for-ai-agents.astro:93`. One token.

## 3. Motion unification (the "delight" lever)

- [ ] **Theme toggle**: hard-pops via `hidden dark:block` (`Nav.astro:42-43`)
  — use the existing `.t-icon-swap` primitive. **Missing entirely on
  mobile** (`hidden sm:inline-flex`, drawer has no toggle) — add to drawer.
- [ ] **FAQ accordion** (`Faq.astro`): unanimated height jump on 8 pages, no
  hover state on summary; only the `+` rotates. Animate open/close
  (grid-rows or interpolate-size), add hover, add reveal.
- [ ] **Integration snippet tabs** hard-swap with `hidden`
  (`Integration.astro:87`) while `AgentPromptSwitcher` crossfades via
  `.panel-stack`. Use panel-stack for both.
- [ ] **Missing transitions**: `Breadcrumbs.astro:11` (color snap),
  `Footer.astro:80-84` bottom-row links (inconsistent with column links).
- [ ] **Missing reveals**: 404, DocsLayout, LegalLayout, error pages,
  `Faq.astro`, `PageHeader.astro` — neighbours reveal, these pop.
- [ ] **Retire the bounce ease** `--check-ease-bob: cubic-bezier(.34,1.35,…)`
  (global.css ~:90) — DESIGN.md forbids overshoot on identity motion.
- [ ] **Tokenize magic timeouts**: Hero copy reset 1800ms vs CodeBlock 1400ms
  (same affordance, different rhythm); hero pulse `setTimeout(2500)` vs
  `--duration-acknowledge: 2400ms` (two sources of truth).
- [ ] **`--ease-in-out` keyword** used on identity motion (copy-state swap,
  icon swap, panel stack) — move to `--ease-smooth-out` per DESIGN.md.

## 4. Judgment calls (decide with Fahim before building)

- [ ] **Homepage scrolled nav** stays near-black over light sections while
  every interior page has a light nav. Options: adopt page theme after the
  hero, or keep ink and tune. Decide, then implement.
- [ ] **Journey receiving slot** is a flat black ellipse in light mode
  (`Journey.astro` `.receiving-slot`); reads as a rubber puck next to the
  hero's rendered depth. Give it the aperture treatment (gradient depth,
  faint periwinkle rim). Dark mode already reads well.

## 5. Identity coverage (the biggest craft lever)

- [ ] **Docs wing has zero brand geometry** (13 pages): aperture mark in the
  sidebar (replace Lucide `BookOpen`, DocsLayout ~:65), kicker treatment,
  reveal pass, designed empty state for the empty TOC column (~:108-110
  reserves 11.5rem and shows nothing).
- [ ] **Error pages as "returned to sender" slips** — redesign
  `docs/errors/[code].astro` with the motif (best motif-fit on the site),
  then link them (§1).
- [ ] **Legal pages**: minimal coat — kicker, hairline structure, CtaBand
  already present. Align `LegalLayout` grid/typography with `DocsLayout`
  (two solutions to one problem today: grid, sticky offsets, sidebar
  headings, TOC active states all differ).
- [ ] **Consolidate the motif family.** Seven hand-rolled reimplementations
  (404 scene, about origin, journey arrival track, fleet map, use-case
  apertures, compare verdict mark, pricing split) vs `RoutingMark.astro`
  used 3× — and in `PageHeader.astro:9` at opacity 0.08 it reads as a
  smudge. Make PageHeader's mark legible or remove; extract shared aperture
  / plane / trace primitives where cheap.

## 6. Layout differentiation (larger swings)

- [ ] `/features/`, `/use-cases/`, `/compare/` are one layout family in three
  hats (numbered route-stop list, alternating sides, ArrowUpRight action).
  Differentiate at least one.
- [ ] `features/[slug]` and `use-cases/[slug]` are byte-equivalent skeletons
  (PageHeader → hairline sections → sticky aside → Faq → CtaBand).
  Distinguish via the feature-summary panel vs a use-case-specific element.
- [ ] `/changelog` release rail is six identical stacked cards — vary the
  rhythm (BRAND: "do not repeat the same layout family down a page").

## Constraints

- Every UI task: invoke `make-interfaces-feel-better` + `transitions-dev`
  first (CLAUDE.md rule 11); `frontend-design`/`design-taste-frontend` for
  new-looking surfaces.
- Motion tokens only; reduced-motion coverage stays complete (it currently
  is — keep it that way).
- Hero and its art are approved — do not reopen (BRAND.md).
- Verify each batch visually at 1440/390, light/dark (screenshot rig lives
  in the session scratchpad; dev server: `npx astro dev --port 4323`).
