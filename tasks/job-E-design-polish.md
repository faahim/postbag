# Job E — Dashboard design polish: from "tidy" to "distinctive"

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Scope: `apps/web/**` only (plus
`apps/server/src/authSetup.ts` is off-limits; if an API gap blocks you, note it).

## Why
The dashboard works end to end and is coherent, but reads as a clean shadcn template. The
owner cares intensely about visual quality: the bar is "people screenshot this". See
`docs/DESIGN.md` (§2 the coat, §3 feel) and `docs/PRINCIPLES.md` §1/§2/§9. Current
screenshots to critique first: `/private/tmp/claude-501/-Users-faahim/fb2ce9a8-ac39-4684-a80a-047f7ebc963b/scratchpad/web-shots/*.jpg`.

**Mandatory before writing code:** invoke with the Skill tool `frontend-design:frontend-design`,
`make-interfaces-feel-better`, `transitions-dev`, and `impeccable` (if available). Re-consult
them for each hero screen.

## Deliverables (in priority order)
1. **Critique memo** (in your report, 10 lines max): what specifically makes the current UI
   generic, per screen. Then fix those things — no redesign for its own sake.
2. **Accent presence.** The wax-seal red barely appears. Give it a deliberate role: primary
   actions, the active nav marker, focus rings, the postmark on `sent`, selection states, the
   logo mark. Keep surfaces calm; the accent should be *rare and intentional*, not sprayed.
3. **First-run hero** (`/app` empty state → quickstart → "Your form is live"): make it feel like
   a moment. Stronger typographic hierarchy (display size for the headline, tighter leading),
   a real postmark illustration (not an icon), the snippet card as the hero object (editor-like
   chrome, language tabs with an animated underline, a copy button with the "copied" morph),
   the "waiting for your first submission…" panel with a gentle animated postmark pulse that
   flips to a stamped "It arrived" with a staggered reveal of the fields.
4. **Inbox + drawer:** denser, more legible rows (monospace ids in a muted chip, field preview
   truncated with fade, status as the postmark badge); drawer with sectioned cards, key/value
   field grid, deliveries as a vertical timeline with postmarks and relative times, meta in a
   collapsible; smooth sheet enter/exit via motion tokens.
5. **Empty states** for every list: one illustration family (postmark/envelope line art as
   inline SVG components), one sentence, one primary action. No generic "No data".
6. **Navigation & chrome:** sidebar with a grouped rhythm, active item with an accent marker,
   icon+label alignment, the org switcher styled, a subtle top-bar bottom hairline; ⌘K palette
   styled to match (not default cmdk).
7. **Dark mode** as a first-class palette: tinted near-black surfaces (not pure #000), accent
   re-tuned for contrast, hairlines visible, shadows replaced by borders/elevation tints.
8. **Feel:** staggered list reveals, hover lift on cards/rows, tabular numerals on every count,
   optical alignment of icons to text, focus rings that look designed, skeletons matching
   layouts, `prefers-reduced-motion` respected. All durations/easings via tokens.

Do not add new features or routes; do not change API calls; keep bundle size reasonable
(no new heavy deps beyond `motion` if needed for choreography).

## Verification
`pnpm lint && pnpm typecheck && pnpm --filter @postbag/web build` green; run the server with
the built SPA (`DATABASE_URL=postgres://postbag:postbag@localhost:5433/postbag BETTER_AUTH_SECRET=devsecretdevsecretdevsecret APP_URL=http://localhost:3000 pnpm --filter @postbag/server dev`)
and capture **before/after-comparable** screenshots of: first-run (empty), "Your form is live",
inbox with drawer (light), inbox (dark), destinations, bag mapping editor, ⌘K open — saved to
`/private/tmp/claude-501/-Users-faahim/fb2ce9a8-ac39-4684-a80a-047f7ebc963b/scratchpad/web-shots-v2/`.
Use Chrome MCP tools if available, else Playwright. Kill processes you start.

## Report
Critique memo; what changed per screen; token/identity changes; screenshot paths; changed-file list.
