# The guide library — operating system

This is the standing discipline for building and growing `/guides/*`: the
long-tail "add a form to X, send it to Y" pages (docs/BACKLOG.md item 1). It
exists so that guide batches produced months apart, by different sessions, come
out indistinguishable in quality, truthfulness, and voice. Read this whole file
before writing or reviewing a guide. The voice source of truth is
`docs/BRAND.md` (see "The guide register"); this file only operationalizes it.

## Why these pages exist (so we optimize the right thing)

A guide is written for two readers at once:

1. A person who asked a search engine or an agent a *task-shaped* question
   ("astro contact form", "send form submissions to telegram") and wants working
   code plus a reason to trust it.
2. A model deciding what to recommend or quote. It rewards pages that answer the
   exact pairing, contain runnable code, agree with the rest of the site, and are
   available as clean Markdown (our twins + llms-full.txt do this).

Both readers punish the same things: thin madlibs content, stale snippets, and
claims the product cannot keep. Fewer, truer, warmer pages beat more pages.

## The registry

Single source of truth for what exists and what is next. Statuses: `shipped`,
`next` (approved, unbuilt), `blocked` (product gap — never write around it),
`declined` (considered, not worth it — keep the reason).

### Framework guides — "Add a contact form to …"

| slug | target | status | notes |
| --- | --- | --- | --- |
| html | plain HTML on any static host | shipped 2026-09-09 | the head term; also catches S3/nginx/"no backend" queries |
| nextjs | Next.js (App Router) | shipped 2026-09-09 | biggest framework head term |
| react | React SPA (Vite) | shipped 2026-09-09 | fetch + state, no server |
| astro | Astro | shipped 2026-09-09 | our own stack; write with extra love |
| vue | Vue 3 SFC | shipped 2026-09-09 | |
| nuxt | Nuxt 3/4 | shipped 2026-09-09 | |
| sveltekit | SvelteKit | shipped 2026-09-09 | |
| hugo | Hugo | shipped 2026-09-09 | static-by-definition crowd, high fit |
| jekyll | Jekyll + GitHub Pages | shipped 2026-09-09 | one page serves both query families |
| eleventy | Eleventy | shipped 2026-09-09 | |
| docusaurus | Docusaurus | next | docs sites want feedback forms |
| remix | React Router v7 (Remix) | next | |
| angular | Angular | next | |
| gatsby | Gatsby | next | on all three competitor libraries (2026-09-09 sweep), so it keeps a row — but those libraries predate Gatsby's decline; lowest priority |
| turnstile | Cloudflare Turnstile + Postbag | next | we support it natively; competitor security guides (Basin, Forminit) show the demand |
| webflow / framer / wix / squarespace | site builders | declined 2026-09-09 | on 3/3 competitor sites, but native forms are the default there and UI-screenshot guides can't meet our runnable-code bar. Revisit for export/code-component angles only |
| wordpress | WordPress | declined 2026-09-09 | plugin ecosystem owns the query (3/3 competitor coverage noted); headless-WP angle may join `next` later |
| server-side (Node/Flask/Django) | backend frameworks | declined 2026-09-09 | Forminit covers these; a dev with a backend needs us least. Revisit if evidence says otherwise |

### Destination guides — "Send form submissions to …"

| slug | target | status | notes |
| --- | --- | --- | --- |
| telegram | Telegram (native Destination) | shipped 2026-09-09 | distinctive: few competitors have it native |
| zapier | Zapier Catch Hook | shipped 2026-09-09 | webhook envelope, honest |
| make | Make custom webhook | shipped 2026-09-09 | |
| n8n | n8n webhook node | shipped 2026-09-09 | self-host crowd = our crowd |
| google-sheets | Sheets via Zapier/Make | next | chained guide; must stay honest that it rides a connector |
| slack | Slack incoming webhook | blocked | Slack requires `{"text": …}`; our webhook sends the Postbag envelope. Needs payload templates (JSONata mapping, ADR-005 / Phase 2) first |
| discord | Discord webhook | blocked | same shape problem as Slack |

Rules for growing the registry: add a row (status `next`) with a one-line
evidence note before building anything; never ship a pairing that needs a
product capability we don't have — move it to `blocked` and say what unlocks it.
Competitor guide libraries (Formspree, Getform, Basin) are the demand proxy we
check against; a topic 3+ of them cover is presumed worth a row.

## Page anatomy (the template contract)

Every guide is a `GUIDES` entry in `apps/site/src/content/guides.ts`, rendered
by `apps/site/src/pages/guides/[slug].astro`. One layout family for all guides —
polish the template, then never fork it per page.

1. **Header** — query-shaped title, ≤20-word lede in the guide register,
   breadcrumbs (Home → Guides → page).
2. **"What you need" plane** — the honest prerequisites (usually: your site,
   five minutes, no account yet) and what the reader will have at the end.
3. **The agent door** — one short section: the copyable agent prompt
   (`AGENT_PROMPT` from config, adapted per pairing). Framed exactly like the
   homepage: the agent can do everything below; you show up to say "keep it".
   Never gate the manual path behind it.
4. **Steps** — numbered, each with prose + one code block. Canonical spine:
   create sandbox Form → wire the snippet (the framework-specific heart) → send
   a test and *see it stored* → claim → connect the Destination → real Delivery.
   Destination guides invert emphasis (Destination is the heart, the form is one
   step). 4–6 steps; a step with two code blocks is two steps.
5. **Gotchas** — the 2–4 things that actually bite in this pairing (framework
   quirks, honeypot placement, origin allowlists). Only real ones; an empty
   section is deleted, never padded.
6. **FAQ** — 3–5 pairing-specific questions, ≤40-word answers, `faqLd`.
   Never repeat a global FAQ from the homepage.
7. **Related rail** — other guides, the matching feature page, one docs link.
8. **Clone door (optional)** — when a public example repo already exists for this
   pairing, a short warm link after the gotchas (and a matching Markdown-twin
   section). Prefer “clone this working example” over “reference implementation.”
   Never invent a repo.
9. **CtaBand.**

Structured data: `webPageLd` + `breadcrumbLd` + `faqLd` + HowTo. Each guide page
gets a Markdown twin (same `[slug]/index.md.ts` pattern as docs) and joins
`llms-full.txt` and the sitemap automatically.

## Truth rules (the ones guides are most tempted to break)

- Facts come from `apps/site/src/config.ts` and the live contract, nowhere else.
  Example ids use `EXAMPLE.*`. The submit endpoint is `POST {API_URL}/s/{form}`;
  it accepts JSON, urlencoded, and multipart; browser posts 303-redirect to
  `/s/{form}/thanks` unless `_redirect` says otherwise; `_gotcha` is the
  honeypot; `_test: true` marks test Submissions; sandbox Forms take five 16 KiB
  test Submissions for 24 h, don't deliver, and don't accept files.
- A sandbox proves receipt, not Delivery (BRAND.md "Claims we do not make").
  Guides say "saved" before claim and "delivered" only after Destination + Route.
- Destination claims: email, Telegram, webhook are native. Zapier/Make/n8n are
  webhook receivers — say so plainly ("Postbag posts JSON; Zapier catches it").
  Never imply a native integration that is actually a webhook, and never ship
  Slack/Discord style guides while the envelope can't match their required shape.
- Every snippet must be runnable as pasted: real field names, the honeypot
  included in HTML forms, correct headers, no `…` inside code. If a step can't
  be verified by the reader in the same guide, the step is wrong.
- Version-sensitive framework code states its floor once ("Next.js 14+, App
  Router") and avoids APIs newer than needed.

## Voice rubric — check every page against this before it ships

Score honestly; fix anything that fails. This is BRAND.md's guide register in
checklist form.

1. **Read-aloud test** on every prose sentence — would you say it to a friend at
   the same desk? Fragments, arrow chains, and spec-sheet drone all fail.
2. **Marketing blocklist** holds in prose (no schema/outbox/worker/idempotency/
   Postgres/payload/HMAC — "signed" and "signature" are fine; so are HTML/HTTP
   terms the step genuinely needs). Blocklisted words may appear *inside code
   blocks and field names* only. `seamless/powerful/robust/effortless/just
   works` never, anywhere.
3. **At least two sentences only true of this pairing.** If the intro survives
   copy-paste into another framework's guide, it isn't written yet.
4. **One micro-story maximum**, intro only. The reference shape: a moment, a
   near-miss, a quiet save. Steps stay declarative.
5. **Subtraction budget:** lede ≤20 words, one supporting paragraph per step,
   FAQ ≤40 words each. Anything restating a neighbouring section gets cut.
6. **No hedging, no hype:** every promise is checkable on the page or one link
   away. Humor never near data loss, security, or billing.
7. **The reader owns the verbs.** "You send a test; Postbag shows it stored" —
   not "the platform enables submission verification."
8. Prose warmth survives the technical density: if three steps in a row read
   like a man page, re-open them with what the reader just gained.

## Production discipline (how a batch runs)

1. Pick rows from the registry (status `next`), 4–10 per batch, mixed
   framework/destination.
2. Snippet drafts and template plumbing may be delegated to cheaper agents with
   tight specs. **Prose is never delegated** — the copy is written by the
   reviewing session itself (Fahim's standing instruction, 2026-09-09), in the
   guide register, against the rubric above.
3. Every snippet gets reviewed against the live contract (or run, once the CI
   harness — BACKLOG item 2 — exists; build it before the library passes ~25
   pages).
4. Gates per batch: `astro check`, `eslint`, site build, twins resolve in
   preview, `llms-full.txt` includes the new pages, browser pass at
   desktop/tablet/mobile in light and dark, rubric pass on every page.
5. Update the registry rows to `shipped` with the date, in the same PR.
6. New pairing ideas discovered mid-batch go into the registry as `next`/
   `declined` rows — not into the batch.
