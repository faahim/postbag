/**
 * Single source of truth for the facts the site states. Everything here is checked against
 * the code in apps/server, packages/core and docs/ — if the product changes, change it here.
 */
export const SITE_NAME = "Postbag"
const env = import.meta.env as Record<string, string | undefined>
export const SITE_URL = (env["SITE"] ?? "https://postbag.withfaahim.com").replace(/\/$/u, "")
/** Where the API and dashboard live. Same origin as the site by default. */
export const API_URL = (env["PUBLIC_API_URL"] ?? SITE_URL).replace(/\/$/u, "")
export const APP_URL = `${API_URL}/app`
export const SIGNUP_URL = `${APP_URL}/sign-up`
export const LOGIN_URL = `${APP_URL}/sign-in`
export const OPENAPI_URL = `${API_URL}/openapi.json`
export const LLMS_URL = `${API_URL}/llms.txt`
export const GITHUB_URL = "https://github.com/faahim/postbag"
export const AUTHOR = { name: "Fahim", url: "https://faahim.dev" }
export const TAGLINE = "A form backend that routes."
export const DESCRIPTION =
  "Postbag is a form backend that routes. Point any HTML form at a Postbag endpoint; every submission is stored durably, then delivered to email, Telegram and signed webhooks by rules. Multi-tenant, self-hostable, and built for AI agents: one API key is enough to create, verify and route a form without a browser."

/** Example ids used in copy. Formats match packages/core/src/ids.ts prefixes. */
export const EXAMPLE = {
  form: "fm_8f3kq2",
  submission: "sb_4d2k91",
  delivery: "dl_a91x02",
  stream: "st_vending",
  destination: "ds_7hm2q0",
  route: "rt_0c3v8k",
}

/**
 * Plan limits, mirrored from apps/server/src/lib/plan.ts. Prices per ADR-006 (USD per month;
 * `yearly` is the per-month price when billed yearly). Billing is not live yet (ADR-007).
 */
export const PLANS = [
  { id: "free", name: "Free", monthly: 0, yearly: 0, forms: 5, submissions: 1_000, destinations: 5, retention: 90 },
  { id: "pro", name: "Pro", monthly: 15, yearly: 12, forms: 50, submissions: 50_000, destinations: 50, retention: 365 },
  { id: "team", name: "Team", monthly: 49, yearly: 39, forms: 500, submissions: 500_000, destinations: 500, retention: 730 },
] as const

/** The site's own Postbag form (project "site", observe mode) — contact form and pricing notify list. */
export const SITE_CONTACT_FORM_ID = "fm_h6eetntqdbp6"

/** Destination types with an adapter in apps/server/src/destinations/registry.ts. */
export const DESTINATIONS = [
  {
    id: "email",
    name: "Email",
    blurb: "Sent through Resend with Reply-To set from the submission, so replying just works.",
  },
  { id: "telegram", name: "Telegram", blurb: "A bot message to any chat, rendered from a template." },
  {
    id: "webhook",
    name: "Signed webhook",
    blurb: "JSON POST with an HMAC-SHA256 signature, timestamp and delivery id. The universal extension point.",
  },
] as const

/** Retry policy, mirrored from docs/ARCHITECTURE.md and packages/core/src/backoff.ts. */
export const RETRY = { formula: "min(2^attempts × 30 s ± jitter, 6 h)", maxEmail: 8, maxWebhook: 10, maxTelegram: 8 }

export const MAX_BODY_KB = 256
