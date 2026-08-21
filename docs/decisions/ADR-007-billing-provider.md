# ADR-007 — Billing through a Merchant of Record (Polar), not Stripe directly

**Status:** Accepted 2026-08-21 (supersedes the "Stripe" line in ROADMAP Phase 3)

## Context
Postbag is sold globally by a one-person company whose legal entity is registered in
**Bangladesh**, operated from Europe. Two facts dominate the choice of billing
provider:

1. **Tax.** Selling subscriptions into the EU, UK, US states and elsewhere makes the
   seller liable for VAT/GST/sales-tax registration and filing in each jurisdiction.
   With Stripe (or any PSP) directly, that burden is ours. A Merchant of Record (MoR)
   is the legal seller, collects and remits the tax, issues the invoices and absorbs
   chargebacks; we receive payouts.
2. **Merchant eligibility.** Stripe does not onboard Bangladeshi merchants directly,
   so "Stripe Billing" was never actually available. Of the MoRs considered
   (checked 2026-08-21): **Dodo Payments** does not list Bangladesh among eligible
   merchant countries (India, Nepal, Bhutan, Sri Lanka and Maldives are listed;
   Bangladesh and Pakistan are not). **Polar** lists Bangladesh for payouts, issued
   via Stripe Connect Express cross-border payouts; Stripe classes Bangladesh as a
   "Preview" payout country, meaning payouts can be paused without notice.
   **Paddle** states it works with sellers "anywhere in the world" except an explicit
   unsupported list, which does not include Bangladesh; payouts by bank, PayPal or
   Payoneer. **Lemon Squeezy** pays non-bank countries via PayPal, which does not
   operate in Bangladesh — effectively unavailable.

Fees at our price point ($15/month, mostly non-US cards): Polar 4% + 40¢ base
(+1.5% international cards, +0.5% subscriptions on the early-member rate; newer
tiers fold the subscription surcharge in), $15 per dispute, Stripe payout fees of
$2/month plus 0.25% + 25¢ per payout and up to 1% cross-border. Dodo is the same
base rate with a $30 dispute fee and a $5 fee on payouts under $1,000. Paddle is
5% + 50¢. The differences are immaterial below a few thousand dollars a month; the
decision turns on eligibility, developer surface and risk.

## Decision
**Polar** is the billing provider for the hosted product.

- Polar is itself open source (Apache-2.0, `polarsource/polar`), which matches the
  project's model (ADR-006) and means a self-hoster who wants billing can point the
  same code at their own Polar organisation.
- Its TypeScript SDK ships adapters for **Hono** and **Better Auth** — the two
  libraries `apps/server` is built on — so checkout, customer portal and webhook
  handling are a plugin, not a subsystem.
- Usage-based billing (meters) exists for the day we meter submissions rather than
  cap them.
- It is the only eligible MoR that is also a fit for the stack. **Paddle is the
  named fallback** if Polar's Bangladesh KYC or the Stripe "Preview" payout rail
  fails in practice.

Integration shape (Phase 3): the org row gains `billing_customer_id` and
`billing_subscription_id`; plan changes arrive **only** through Polar webhooks
(`subscription.*`), verified with the Standard Webhooks signature and applied by the
same outbox/worker discipline as everything else — never from the checkout redirect.
`plan` limits remain the source of truth in `apps/server/src/lib/plan.ts`; billing
just sets `organizations.plan`. When `POLAR_ACCESS_TOKEN` is unset the billing
routes return `501 billing_disabled` with a hint, and the instance behaves as
`selfhost`.

## Alternatives
- **Dodo Payments.** Good developer surface (Standard Webhooks, CLI, credits
  billing) and emerging-market focus, but the entity is not eligible. Rejected.
- **Stripe directly.** Lowest fees, but not available to the entity and would make
  us the global tax filer. Rejected.
- **Paddle.** Eligible and the most established MoR; heavier onboarding (site
  review), no Hono/Better Auth integration, 5% + 50¢. Kept as fallback.
- **Re-domiciling the entity** (e.g. a Swedish enskild firma/AB if the founder is tax
  resident there, or a US LLC via Stripe Atlas) would open every provider including
  Stripe. That is a company decision with tax consequences, out of scope for this
  ADR; if it happens, this ADR is revisited but Polar remains a fine choice.

## Consequences
- `ROADMAP.md` Phase 3 reads "Polar" instead of "Stripe".
- A human-required item exists in `PROGRESS.md`: create the Polar organisation,
  complete KYC with Bangladeshi documents and a local bank account, and confirm a
  test payout lands before any billing code merges. If it fails, switch the ADR's
  provider to Paddle by a superseding ADR.
- Because the seller of record is Polar, our Terms of Service reference Polar's
  terms for payment; our Privacy Policy lists Polar as a sub-processor.
- Non-EU entity storing EU personal data: GDPR Art. 27 requires an EU representative
  unless an exemption applies. Tracked with the legal pages, not a billing concern.
