# Backlog — ideas we believe in but have not scheduled

Growth and product ideas that have been argued for and accepted in spirit, waiting
for their moment. Each entry records the idea, why it wins, and what unlocks it —
so a future session can pick one up without re-deriving the case. When an item
becomes active work, move it into `PROGRESS.md` "Next up" and link its spec.
`tasks/visual-craft.md` remains the separate site-polish backlog.

## 1. Guide library — the long-tail integration pages (ACTIVE 2026-09-09)

**Idea:** a page for every "add a form to X, send it to Y" pairing (Astro contact
form, Next.js form to Telegram, Hugo form without a backend, …), each with working
copy-paste code, an agent-prompt variant, and a live-testable path via the
anonymous sandbox.

**Why it wins:** nobody discovers the category by the phrase "form backend"; all
discovery flows through specific how-do-I questions, in search engines and in
agent answers alike. Content originates traffic; everything else on the site only
converts it. The same pages serve GEO — models recommend tools whose docs answer
the exact pairing with quotable, working code.

**Status:** spec and operating system in `tasks/guides-system.md`. First batch
shipped from that spec; the registry inside it tracks every pairing (shipped /
next / not-yet-worth-it) so later batches stay disciplined.

## 2. Verified-guides CI harness

**Idea:** every guide's snippet is executed against the real API in CI — create an
anonymous sandbox, run the guide's exact submit code, assert the Submission
landed. Badge the guides family with "every example ran against production this
week."

**Why it wins:** programmatic content rots, and rotted examples are how both
Google and models learn to distrust a domain. Executable-in-CI docs are
proof-by-invariant applied to documentation — on-brand, and structurally hard for
competitors to copy. This is what lets the guide library scale without a quality
cliff.

**Unlocks:** the guide library existing (item 1); a CI job with network access to
`postbag.dev` and the sandbox rate limits in mind (5/10s edge rule — the job must
pace itself or use a self-hosted server container instead).

## 3. "Powered by Postbag" on the hosted thanks page (free tier)

**Idea:** browser-form submissions without a custom `_redirect` already land on
the hosted `/s/{form}/thanks` page. On the Free plan, give that page a quiet,
well-designed "Delivered by Postbag — your forms have somewhere to go" line
linking home. Paid plans and custom redirects never show it.

**Why it wins:** the classic compounding loop — the product's own usage puts
tasteful backlinks on thousands of customer domains, seen by exactly the people
who have forms. Deliberately sequenced *after* item 1: loops multiply existing
flow, and the guide library creates the flow worth multiplying.

**Unlocks:** enough live Forms that the loop has surface to compound on; a pass
over the thanks page design so the line is an ornament, not an ad; a plan-limits
note in `DOMAIN-MODEL.md` (it is a plan-differentiated behaviour, so it needs the
same care as any limit).
