# ADR-006 — Open source under AGPL-3.0 (server) and MIT (clients); hosted plans differ only in limits

**Status:** Accepted 2026-08-21

## Context
Postbag was designed self-hostable from day one (PRINCIPLES §7: "the hosted product is
the same image with billing turned on"). The public site already advertises
self-hosting and links to `github.com/faahim/postbag`, and the agent surface promises
`@postbag/sdk`, a CLI and an MCP server on npm. None of that can ship from a private
repository with no licence: npm needs a `license` field, and the MCP registry's
GitHub namespace expects a public repo. We also intend to sell hosted plans. The
decision is therefore the business model as much as the licence.

Every competitor in `apps/site/src/content/compare.ts` (Formspree, Formspark,
Forminit, Basin, Web3Forms, Netlify Forms) answers "Self-hosting: No". Open source is
the one claim in the category nobody else can make, and for a solo builder it is a
distribution channel (directories, templates, stars, Show HN), not lost revenue:
people who will run Postgres for a contact form were never the paying segment; the
paying segment is the operator who does not want to own deliverability and uptime.

## Decision
1. **Model: open source + hosted, limits only.** The hosted product and the
   self-hosted image are the same code with the same features. Plans differ only in
   limits (forms, submissions/month, destinations, retention) plus team/compliance
   extras (seats, audit log, DPA) that are inherently hosted concerns. No feature is
   gated to force an upgrade; form count is the paywall, and it maps onto the operator
   persona exactly.
2. **Licence split.**
   - `AGPL-3.0-only` for everything that runs the service: the repository root,
     `apps/*`, `packages/core`, `packages/db`, `packages/auth`.
   - `MIT` for everything that runs inside a customer's code or agent:
     `packages/sdk`, `packages/cli`, `packages/mcp` (and any future client). The
     `submit()` helper executes in customers' own sites; it must carry no copyleft.
3. **No CLA.** Contributions are accepted under the inbound=outbound rule with a DCO
   sign-off. This forecloses a later proprietary dual-licence without contributor
   consent; we accept that. If a commercial licence is ever needed, it will be a new
   ADR and will apply only to code we own.
4. **Support policy.** Hosted plans get email support. Self-host is community
   supported through GitHub issues, best effort, triaged by the agent pipeline.
5. **Prices** (published on `/pricing` before billing exists, as a demand test):
   Free $0 · Pro $15/month or $12/month billed yearly · Team $49/month or $39/month
   billed yearly. Limits as in `apps/server/src/lib/plan.ts`.

## Alternatives
- **MIT everywhere.** Simplest and widest adoption; accepts that a host could resell
  Postbag as a service without contributing back. Rejected: AGPL costs us nothing
  with our audience and removes that one failure mode.
- **Source-available (FSL / BSL).** Strongest commercial protection, but not open
  source: excluded from most self-hosting directories and weaker for trust with the
  developer persona. Rejected; revisit only if a rehosting competitor actually appears.
- **Open core (features gated in hosted).** Rejected: it breaks PRINCIPLES §7 and the
  "every feature on every plan" promise already on the site, and it taxes the solo
  dev to serve the operator (PRINCIPLES §1).

## Consequences
- `LICENSE` (AGPL-3.0) at the repository root; `LICENSE` (MIT) inside each client
  package; `license` field in every `package.json`. Client packages publish to npm
  as public; the rest stay `private: true`.
- The repository goes public together with the first npm release, after a
  full-history secret scan (gitleaks, clean as of 2026-08-21, 18 commits).
- Self-hosters run with `plan = selfhost` (effectively unlimited). Billing code is
  hosted-only behind configuration (ADR-007) and must never be required to boot the
  image.
- Terms of Service, Privacy Policy, a DPA and a sub-processor list are prerequisites
  for selling; they are tracked in `PROGRESS.md`.
