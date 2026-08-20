# Job C — `apps/web`: the Postbag dashboard (Vite + React + shadcn/ui) and `packages/sdk`

You are building the dashboard of **Postbag** at `/Users/faahim/Developer/postbag` (branch
`main`; no git commands; leave changes in the working tree; finish with the changed-file list).
The API (`apps/server`) exists and runs locally; the dashboard is **just another client of
`/v1`** (Principle 5) — nothing may bypass the public API.

## Read first
1. `CLAUDE.md` (rule 11), `docs/PRINCIPLES.md` (§1 personas, §2 defaults that hide concepts, §3 vocabulary — UI label for `stream` is **Bag**), `docs/DESIGN.md` (all of it — it is the brief).
2. `docs/AGENT-NATIVE.md` §2 (the quickstart shape — the first-run screen mirrors it).
3. `api/openapi.yaml` and the live `GET http://localhost:3000/openapi.json` (generated; the truth).
4. `apps/server/src` — learn the auth flow (Better Auth at `/api/auth/*`, organization plugin, session cookie), `/v1/api-keys`, and how `/app/*` static serving + history fallback works (`apps/server/public`).
5. `tasks/job-B-server.md` for context on what the API guarantees.

**Before writing any UI code, invoke these skills with the Skill tool and follow them:**
`make-interfaces-feel-better`, `transitions-dev`, `frontend-design:frontend-design`. This is
mandatory (CLAUDE.md rule 11). Re-consult them when building each hero screen.

## File boundary
`apps/web/**` (new), `packages/sdk/**` (new), root `package.json` scripts (`dev:web`, `build`
wiring so the web build lands in `apps/server/public`), the root `Dockerfile` **only** to add
the web build stage that copies `apps/web/dist` → `apps/server/public`. Do not touch `docs/`,
`api/`, `CLAUDE.md`, `README.md`, `PROGRESS.md`, `apps/server/src` (if the server needs a tiny
change, e.g. CORS for the Vite dev origin, make it minimal and list it).

## Stack (fixed)
Vite 6 + React 19 + TypeScript strict. Tailwind v4 with CSS variables (oklch) as the only
colour source. **shadcn/ui copied into `apps/web/src/components/ui`** (init with the CLI; new-york
style; neutral base) — it is our code. TanStack Router (file-based) + TanStack Query; TanStack
Table for lists; react-hook-form + zod (reuse `@postbag/core` input schemas); `better-auth/react`
client; `lucide-react` only; `sonner` for toasts; `cmdk` for ⌘K. Fonts self-hosted via
`@fontsource-variable/instrument-sans` (UI) and `@fontsource-variable/jetbrains-mono` (ids,
payloads, code) — never Inter, never a CDN. Motion: CSS transitions/animations driven by
tokens (`--duration-fast/base/slow`, `--ease-out-quint` etc.), `prefers-reduced-motion` respected;
`motion` (framer) allowed only for list choreography if CSS can't do it.

## `packages/sdk`
`openapi-typescript` generates `src/schema.d.ts` from the server's `/openapi.json` (script
`pnpm --filter @postbag/sdk generate` that fetches `http://localhost:3000/openapi.json`; commit the
generated file). Export `createClient({ baseUrl, apiKey?, credentials? })` built on
`openapi-fetch` (typed paths), plus `submit(formIdOrUrl, data, opts?)` for browsers/servers.
Tiny README. The dashboard uses this client exclusively.

## The identity coat (do this first, once — see DESIGN.md §2)
- `src/styles/tokens.css`: light + dark palettes in oklch; surfaces near-neutral with a warm
  tint; **accent = wax-seal red** (≈ `oklch(0.55 0.19 25)` light / `oklch(0.68 0.17 25)` dark);
  success/warn/destructive tuned to sit with it; radius scale (`--radius: 0.5rem`, tighter than
  shadcn default); shadow scale (layered, soft); motion tokens. Map shadcn's CSS variables to these.
- Typography scale with `font-feature-settings: "tnum"` on numeric cells; mono for ids/payloads.
- **Signature motif — the postmark**: a small circular "stamp" treatment (SVG, one component,
  `<Postmark status>`), used for delivery status badges (`sent` = clean stamp, `failed` = smudged,
  `dead` = red, `pending` = outline), and echoed in empty states and the logo mark. Subtle, one motif.
- Designed empty states for every list (illustration = the motif family, one line of copy, one
  primary action). The Forms empty state *is* onboarding.
- Light/dark both first-class; system default; toggle in the user menu.

## Screens (Phase 1) — solo-dev path gets the polish budget first
Routes live under `/app`. Layout: slim left sidebar (Forms, Inbox, Bags, Destinations, Deliveries,
Events, API keys, Settings), top bar with ⌘K and org switcher, content max-width comfortable.

1. **Auth** — sign in / sign up (email + password) on a calm split layout; errors inline; after
   signup land on first-run.
2. **First-run / Forms empty state** — "Create your first form": name + notify email (+ optional
   origin) → calls `/v1/quickstart` → shows the embed snippet (tabs: HTML / fetch / React / Astro /
   Next.js action; copy button with a "copied" micro-state) and a live "waiting for your first
   submission…" panel that flips to the submission when it arrives (poll `/v1/forms/{id}/submissions`
   every 3 s while this panel is open). **Time to first email under three minutes.** This is the hero.
3. **Forms** — list (name, project, submissions 30d, last submission, drift badge, status) → **Form
   detail** tabs: *Inbox* (submissions table with status chips, quick view drawer showing fields +
   meta + deliveries timeline with postmarks; mark spam / not spam; search), *Embed* (snippets),
   *Fields* (current schema rendered read-only + drift list with "publish what we're seeing" button
   that posts the inferred schema as a new version), *Send to* (routes on this form: destination,
   enabled toggle, window; add route = pick destination or create one inline), *Settings*
   (allowed origins, redirect, honeypot, rate limit, reply-to field, pause, danger zone).
4. **Inbox** — org-wide submissions with filters (form, status, bag, date, search); same drawer.
5. **Destinations** — list with health dot; create sheet with type picker (Email / Telegram /
   Webhook) and type-specific fields; **Test** button showing the provider response inline with a
   success check animation.
6. **Bags** — list → detail: *What gets delivered* (stream schema fields), *Sources* (forms +
   mapping status; attach form → "Match fields" editor: for each bag field a select of the form's
   known fields, `const`, or leave unmapped; incomplete shows exactly which required fields are
   missing — the API's 422 drives this), *Send to* (routes), *Preview* (pick a recent submission,
   see the mapped payload).
7. **Deliveries** — the outbox: filters by status/destination, row → payload + last response,
   Retry action (optimistic).
8. **Events** — simple reverse-chronological feed with type chips.
9. **API keys** — create (scopes), shown once with copy, revoke.
10. **Settings** — org name, timezone; user menu: theme, sign out.

Progressive disclosure (Principle 2): Bags and Deliveries nav items are visible but the Forms
detail never mentions bags until the org has ≥ 2 forms; route creation defaults to "Send to a
destination" with "Put in a bag" as the secondary path.

## Feel rules (DESIGN.md §3) — checked in review
Motion tokens only; enter/exit choreography on drawers/sheets/dialogs/toasts and staggered list
reveals; optimistic mutations with rollback; skeletons not spinners; no layout shift; keyboard
reachable everything; ⌘K navigates + creates; hover states on every clickable; focus rings
intentional; tabular numbers; hairline borders; layered shadows. Reduced motion respected.

## Build + serve
`pnpm --filter @postbag/web build` outputs to `apps/server/public` (base `/app/`). Vite dev
proxies `/api` and `/v1` and `/s` to `localhost:3000`. Add the web build stage to the root
Dockerfile so the production image serves the SPA. Keep bundle reasonable (route-level code
splitting; no moment/lodash).

## Verification (run; paste results)
```
pnpm install && pnpm lint && pnpm typecheck
pnpm --filter @postbag/sdk generate   # against a running server
pnpm --filter @postbag/web build && ls apps/server/public
# run the server with the built SPA and walk the hero path end to end in a real browser
# (Chrome MCP tools if available, else Playwright): sign up → first-run → quickstart → copy snippet
# → POST a submission with curl → see it appear live → open it → mark spam → create a webhook
# destination → Test → add a route → Deliveries shows `sent`. Capture screenshots of: first-run,
# form inbox with drawer open, destinations, bag mapping editor, dark mode of the inbox. Save
# them under /private/tmp/claude-501/-Users-faahim/fb2ce9a8-ac39-4684-a80a-047f7ebc963b/scratchpad/web-shots/
# and list the paths in your report.
docker build -t postbag:local .   # must succeed and serve /app
```

## Report
What you built; the token/identity decisions you made (fonts, accent values, radius, motif);
deviations + reasons; verification transcript (trimmed); screenshot paths; changed-file list.
