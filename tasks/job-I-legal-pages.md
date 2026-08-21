# Job I — Legal pages: Terms, Privacy, DPA, sub-processors

Repo `/Users/faahim/Developer/postbag` (branch `main`; **no git commands**; leave changes in the
working tree; finish with the changed-file list). Read `CLAUDE.md`, `docs/PRINCIPLES.md`,
`docs/ARCHITECTURE.md` (what we store, retention, outbox, spam handling), `docs/DOMAIN-MODEL.md`,
`docs/decisions/ADR-006-license-and-business-model.md`, `ADR-007-billing-provider.md`,
`PROGRESS.md` ("Email", "Operations", item 2b), and the site: `apps/site/src/config.ts`,
`apps/site/src/layouts/Base.astro`, `apps/site/src/components/Footer.astro`,
`apps/site/src/pages/about.astro` (has a `#privacy` anchor today), `apps/site/src/content/docs/*.md`
(how long-form pages are written and rendered), `apps/site/src/lib/seo.ts`. Keep `pnpm --filter
@postbag/site typecheck` and `pnpm lint` green. Before touching layout, invoke the
`make-interfaces-feel-better` skill and follow `docs/DESIGN.md`.

**File boundary:** `apps/site/**` only. Do not touch `apps/server`, `apps/web`, `docs/`, `PROGRESS.md`.

## The facts (put them in `apps/site/src/config.ts` as `LEGAL`, single source of truth)
```ts
export const LEGAL = {
  operator: "Md Afiur Rahman",            // sole operator; no registered company yet
  tradingAs: "Postbag",
  address: "Dhaka 1209, Bangladesh",      // mailing address of record
  email: "hello@postbag.dev",
  governingLaw: "Bangladesh",
  effectiveDate: "2026-08-21",
  dataLocation: "Singapore (Oracle Cloud Infrastructure); migration to an EU region is planned",
} as const
```
Write every page from these constants; never hardcode the name or address in copy.

## Pages (Markdown content like the docs, rendered with the docs layout; each also gets a `.md` twin
the way docs pages do, so agents can read them)
1. `/legal/terms/` — Terms of Service. Plain English, short sections: who we are (operator, trading as
   Postbag, contact); the service (a form backend; free plan limits as on `/pricing`; paid plans "when
   available" are sold through a Merchant of Record — Polar — whose terms govern payment); your
   account (accurate info, keep keys secret, one person per account, you're responsible for forms you
   create); acceptable use (no spam/phishing, no collecting data you have no right to collect, no
   unlawful content, no abuse of the submit endpoint; we may suspend for abuse — submissions are
   never deleted by us except per retention/your action); your data (you own submissions; we process
   them only to provide the service — see Privacy and DPA); availability ("as is", best effort, no
   SLA on free; we keep backups); open source (AGPL server, MIT clients; self-hosting is yours to
   run); termination (you can delete your account; export first); liability cap (to the greater of
   fees paid in 12 months or USD 50); changes (we post the date; material changes emailed 14 days
   ahead); governing law and venue; contact.
2. `/legal/privacy/` — Privacy Policy covering **two roles**, clearly separated:
   - *Account holders* (our users): what we collect (name, email, password hash or OAuth identity
     from Google/GitHub, API keys, usage logs, IP/country from Cloudflare), why (provide the service,
     security, transactional email), legal bases (contract, legitimate interest), retention (account
     lifetime + 30 days), rights (access, rectification, erasure, portability, objection — email us),
     cookies (the dashboard sets a session cookie only; the marketing site sets none; no analytics
     cookies — verified: public pages return no Set-Cookie), who sees it (sub-processors),
     international transfers (operator in Bangladesh; hosting currently in Singapore — say so; EU
     hosting planned; safeguards: TLS in transit, access limited to the operator), children (not for
     under-16s), contact, EU representative note (none appointed yet; processing is small-scale — state
     this honestly).
   - *Form submitters* (visitors of our customers' sites): we are a **processor** acting for the
     site owner (the controller); what arrives (the fields they submit, IP, user agent, country,
     timestamp); we deliver it where the site owner configured; retention per plan (90 days free,
     longer on paid; customers can delete); we never sell or use it for anything else; to exercise
     rights, contact the website that hosted the form, or us and we'll forward.
3. `/legal/dpa/` — Data Processing Addendum for customers (the operator persona): GDPR Art. 28 terms —
   subject matter, duration, nature, categories of data subjects and data, instructions, confidentiality,
   security measures (TLS, HMAC-signed webhooks, per-org scoping + RLS second fence, hashed keys,
   encrypted-at-rest disk, backups 14 days), sub-processors (list + 14-day notice of changes), assistance,
   deletion/return at end, audit by documentation, international transfers. It's "accepted by using the
   service"; no signature needed on free plans (note that a signed copy is available on request).
4. `/legal/subprocessors/` — table (confirmed facts): Cloudflare (DNS, reverse proxy, TLS, email
   forwarding for hello@; global network), Oracle Cloud Infrastructure (production server and database —
   Singapore region; EU migration planned), Resend (transactional + notification email; EU region,
   eu-west-1), Polar (payments, when billing is on; Merchant of Record), Google / GitHub (sign-in only,
   when the user chooses them). Columns: purpose, data, location.
5. Footer: add a "Legal" column linking the four pages; replace the `/about/#privacy` anchor link with
   `/legal/privacy/` and make `/about/#privacy` redirect or link there.
6. `llms.txt`-style discoverability: add the four URLs to the site's sitemap (should be automatic) and to
   `apps/site/src/pages/llms-full.txt.ts` if it lists pages.

## Tone and quality bar
Readable by a solo developer in five minutes; no legalese theatre, no invented certifications. Every
claim about the product must be true in the code today (check before writing: cookies, retention,
backups, encryption). Where the law wants a fact we don't have (e.g. an EU representative), say so
plainly rather than pretending. Include "Last updated: {effectiveDate}" on each page.

## Acceptance
- [ ] Four pages live at `/legal/*`, built from the `LEGAL` constants, with `.md` twins
- [ ] Footer "Legal" links; `/about/#privacy` points to the new policy
- [ ] `astro check` 0 errors; `pnpm lint` clean
- [ ] Report lists every factual claim you could not verify in code
