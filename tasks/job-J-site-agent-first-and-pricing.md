# Job J — Landing page leads with the agent; pricing cards fixed; reveal-on-load bug

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Read `CLAUDE.md` (rule 11), `docs/DESIGN.md`,
`docs/PRINCIPLES.md` §1 (two personas) and §8, then `apps/site/src/pages/index.astro`,
`apps/site/src/components/home/{Hero,Integration,AgentNative}.astro`, `apps/site/src/pages/pricing.astro`,
`apps/site/src/components/PricingNotify.astro`, `apps/site/src/components/CodeBlock.astro`,
`apps/site/src/scripts/reveal.ts`, `apps/site/src/styles/global.css` (the `[data-reveal]` rules),
`apps/site/src/config.ts`. **Before writing any UI, invoke** `make-interfaces-feel-better`,
`transitions-dev` and `design-taste-frontend` via the Skill tool. Keep `pnpm --filter @postbag/site
typecheck`, `pnpm lint` and `pnpm --filter @postbag/site build` green. Stay inside `apps/site/**`.
No new dependencies. Hardcoded colour classes are lint errors; motion uses the existing tokens.

**Why.** Two observations from the live site (https://postbag.dev, 1456 px wide, dark theme):
1. Landing on the page gives no "AI-native" cue. The hero is a demo HTML form; the agent story
   only appears four sections down. here.now does this better: you land, you see *the one thing
   to paste into your agent*, you're done in ten seconds. Postbag now has that path for real
   (paste-prompt → agent reads llms.txt → email-code key → quickstart → form), so the hero should
   lead with it.
2. The pricing cards are broken at desktop width: in the 4-column grid the "Notify me" row
   (email input + button) overflows the card and the helper text runs past the edge; the Team
   card is taller than the others; the inverted Self-host card jars in dark mode.
3. **Bug:** on first paint, above-the-fold `[data-reveal]` content renders dimmed/invisible
   (hero headline at low opacity, demo form not visible, pricing cards blank) until the user
   scrolls. Seen on both pages 2–3 s after load. `reveal.ts` uses `inView` from `motion` with
   `amount: 0.15` and a `-12%` bottom margin; something about elements already in the viewport at
   setup (or the `reveal-ready` class timing, or the 2 s `reveal-force-visible` fallback) isn't
   making them visible immediately. Fix the root cause, not the symptom.

## 1. Reveal bug (do this first — it affects how you judge everything else)
Reproduce with a headless browser (Playwright is available via `npx playwright` if installed, or the
`.playwright-mcp` tooling the repo has used before; otherwise reason from the code and add a
deterministic fallback). Requirements after the fix:
- Elements in the initial viewport are visible **on first paint** (no flash of hidden content): mark
  them `data-in` synchronously before the first frame, or render them visible by default and only
  hide-then-reveal elements *below* the fold.
- Elements below the fold still stagger in on scroll as today.
- Reduced motion and no-JS paths unchanged.
- The 2 s force-visible safety net stays as a last resort.
Test: a screenshot at 300 ms after load shows the hero fully opaque.

## 2. Hero: the agent path first (`Hero.astro`, `index.astro`)
Design direction (own it — but this is the bar):
- Headline stays "A form backend that routes." (it's the brand line), sub-line gains the agent
  promise in one sentence, e.g. "Paste one line into your coding agent and your site has a
  working, routed contact form — no dashboard, no human in the loop."
- Below it, **the primary object is a single copyable prompt block**, large, with a copy button
  that swaps to a check (reuse the `t-icon-swap` pattern) and a one-line caption "Works with
  Claude Code, Cursor, Codex, Windsurf — any agent that can read a URL." The prompt text comes
  from one constant (already in `AgentNative.astro` as `promptText`; move it to `config.ts` as
  `AGENT_PROMPT` and import it everywhere):
  `Set up a contact form on this site with Postbag. Read https://postbag.dev/llms.txt first.`
- A compact segmented control under it offers the two other routes without adding noise:
  **Prompt** (default) · **Skill** (`npx skills add faahim/postbag --skill postbag`) ·
  **MCP** (`npx -y @postbag/mcp`, env `POSTBAG_API_KEY`) · **CLI** (`npx postbag login`, `npx postbag init`).
  Each tab is a copyable one-liner (use `CodeBlock`); switch with the sliding-tabs transition from
  `transitions-dev`, no layout shift between tabs (fixed block height).
- Human path stays one click away: a secondary button "Or create a form by hand" → `/app/sign-up`,
  and the existing live demo form moves **into the Integration section** right below the hero
  (it's a great "that's the whole integration" proof, it just shouldn't be the first thing).
- Keep the three-minute / never-lost trust line somewhere in the hero's eyeline (small type).
- Mobile: the prompt block is full-width, the segmented control scrolls horizontally if needed,
  copy button ≥ 44 px tap target.
- Remove the now-duplicated three-option block from `AgentNative.astro`; that section becomes the
  *explanation* of what the agent does with the prompt (reads llms.txt → mints its own key by
  email code → quickstart → embed → verifies a test submission), ideally as the existing
  step-style layout with the two API calls shown once. Don't delete the `postbag.json` /
  CLAUDE.md convention part — it's useful — just make sure nothing is said twice on the page.
- Update the `for-ai-agents` page's hero block to reuse the same component so the two stay in sync.

## 3. Pricing page (`pricing.astro`, `PricingNotify.astro`)
- Grid: 1 column < 640 px, 2 columns to ~1100 px, 4 columns only ≥ 1280 px — cards need ≥ 280 px of
  inner width for the inline email + button; below that, stack the input above the button.
- `PricingNotify`: input and button must never overflow — `min-w-0` on the input, `shrink-0` on the
  button, wrap to two rows under 300 px; helper copy truncates to one line or wraps cleanly (no
  overflow). Success/error states reserve their space (no jump).
- Equal card heights: rows aligned (`grid` with a fixed rows template or flex with `mt-auto` on
  the CTA), the Team "Seats, audit log, DPA" row must not push the CTA out of line — either add
  an equivalent row to the others ("—") or pin CTAs to the bottom.
- Self-host card: keep it distinct but in-palette — use `bg-surface-2`/ring with the accent
  postmark mark rather than the fully inverted block, and make it read as "also free, different
  path", not as a dark-mode mistake. Check both themes.
- Price line: `$15` large with `/month` small, "$12/month billed yearly" beneath — keep, but use
  `tabular-nums` and align baselines across cards.
- The first paint of the cards is covered by §1.

## 4. Verify
- `pnpm --filter @postbag/site build` then look at `apps/server/dist/site/index.html` and
  `pricing/index.html` in a headless browser at 390, 768, 1280 and 1456 px wide, both themes, and
  save screenshots to `/private/tmp/claude-501/-Users-faahim-Developer-postbag/7221d5c2-092f-44a0-bd03-19599ba70abb/scratchpad/site-shots/` (the orchestrator reviews them). If no headless
  browser is available, say so explicitly.
- Lighthouse-style sanity: no horizontal scroll at any width; no console errors.

## Acceptance
- [ ] First paint shows above-the-fold content (hero, pricing cards) fully visible
- [ ] Hero leads with the copyable agent prompt + Prompt/Skill/MCP/CLI switcher; demo form lives in Integration
- [ ] Nothing said twice on the home page; `for-ai-agents` reuses the hero block
- [ ] Pricing cards: no overflow at any width, equal heights, Self-host card in-palette
- [ ] `astro check` 0 errors, `pnpm lint` clean, build ok, screenshots saved
