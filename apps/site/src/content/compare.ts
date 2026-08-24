import type { Faq } from "@/lib/seo"

/**
 * Competitor facts were checked against each vendor's own pages in August 2026 (sources listed on
 * each page). Prices and quotas change; every page says so and links to the vendor. Where a fact
 * could not be verified from the vendor it is marked as such rather than guessed.
 */
export type Row = { label: string; postbag: string; them: string }
export type Competitor = {
  slug: string
  name: string
  tagline: string
  site: string
  sources: { label: string; href: string }[]
  title: string
  description: string
  lede: string
  summary: string
  rows: Row[]
  whenThem: string[]
  whenUs: string[]
  faqs: Faq[]
  checked: string
}

const PB = {
  free: "5 forms, 1,000 submissions/month, 5 destinations, 90-day retention",
  paid: "Pro $15/month ($12/month billed yearly); Team $49/month ($39/month billed yearly)",
  api: "Full /v1 API for every object (forms, schemas, streams, mappings, destinations, routes, deliveries, events), OpenAPI generated from the live routes",
  webhooks: "Yes, HMAC-SHA256 signed (Postbag-Signature t=…,v1=…), retried with backoff, dead-lettered and retryable",
  email: "Yes (Resend), Reply-To from the submission",
  chat: "Telegram today; Slack and Discord next",
  spam: "Honeypot, per-form rate limit, origin allowlist, Cloudflare Turnstile; spam is stored and reversible, never dropped",
  uploads: "Not yet (text fields only; 256 KB)",
  selfhost: "Yes: one Docker image + Postgres, same image as the hosted product",
  schema: "Versioned, immutable form and stream schemas; observe / enforce / managed modes; drift detection and inference",
  multi: "Projects, tags, streams (many forms → one schema → one destination), delivery windows, digests",
  agents: "llms.txt, openapi.json, GET /v1/me, POST /v1/quickstart, _test submissions with delivery ids to poll, errors with hint + docs, Idempotency-Key, if_exists: return",
  lock: "None",
}

export const COMPETITORS: Competitor[] = [
  {
    slug: "formspree",
    name: "Formspree",
    tagline: "\"a form backend, API, and email service for HTML & JavaScript forms\"",
    site: "https://formspree.io/",
    sources: [ { label: "formspree.io/plans", href: "https://formspree.io/plans" }, { label: "Verify webhook signatures", href: "https://help.formspree.io/articles/advanced-features/verify-webhook-signatures" }, { label: "The Formspree CLI", href: "https://help.formspree.io/hc/en-us/articles/360053819114-The-Formspree-CLI" } ],
    title: "Postbag vs Formspree: a routing form backend vs the original form-to-email service",
    description: "Postbag compared with Formspree for developers choosing a form backend: free tiers, API access, signed webhooks, spam protection, self-hosting, schema validation, multi-site routing, and support for AI agents.",
    lede: "Formspree is the best-known form backend, and a fine default for one site and one inbox. Postbag is for when messages must survive, follow rules, or be set up by an agent without a browser.",
    summary: "Both accept HTML form posts and send email. Formspree's API and webhooks are paid-tier features and its source is closed; Postbag exposes every object through one API from the free tier, signs every webhook, keeps every submission as a row with an attempt-tracked outbox, adds streams for many-sites-to-one-partner routing, and self-hosts as one container.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "50 submissions/month, unlimited forms, 30-day history; API and uploads not on free (Formspree plans page)" },
      { label: "Entry paid", postbag: PB.paid, them: "Personal from $15/month; API and webhooks from Pro ($30/month) per third-party pricing roundups (vendor page blocks direct fetch)" },
      { label: "Management API", postbag: PB.api, them: "Per-form API keys (read-only and master) on Pro+; `formspree.json` + CLI for form definitions" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Yes on Pro/Business; signed (Formspree-Signature, HMAC-SHA256 over timestamp.body)" },
      { label: "Email", postbag: PB.email, them: "Yes" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack, Telegram, Discord (plugins)" },
      { label: "Spam", postbag: PB.spam, them: "Formshield ML, reCAPTCHA, Turnstile, honeypot" },
      { label: "File uploads", postbag: PB.uploads, them: "Yes, paid plans" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No; legacy open-source repo archived 2023" },
      { label: "Schemas and drift", postbag: PB.schema, them: "Rules engine on Business; no versioned schemas" },
      { label: "Many sites → one destination", postbag: PB.multi, them: "Projects; per-form integrations" },
      { label: "For AI agents", postbag: PB.agents, them: "CLI; no llms.txt or MCP found" },
    ],
    whenThem: ["You want the most established name and a large plugin catalogue.", "You need file uploads today.", "You are happy paying per-site for the API tier."],
    whenUs: ["You run several sites that should feed one inbox, CRM or partner in one shape.", "You need a durable record of every submission and every delivery attempt, retryable.", "An AI agent is building the site and should set the form up end to end.", "You want to self-host the same image the hosted product runs."],
    faqs: [
      { q: "Is Postbag a Formspree alternative?", a: "Yes, for the core job (an endpoint for HTML forms that emails you). It differs in routing (streams, mappings, windows, digests), in durability (every submission is a row, deliveries are an outbox), in being self-hostable, and in being built for AI agents." },
      { q: "Can I migrate from Formspree?", a: "Change the form's <code>action</code> to your Postbag submit URL and keep your field names. Postbag's honeypot field is <code>_gotcha</code> by default, the same name Formspree uses, and <code>_redirect</code> / <code>_subject</code> behave as you would expect. There is no import of historical submissions." },
    ],
    checked: "2026-08-21",
  },
  {
    slug: "formspark",
    name: "Formspark",
    tagline: "\"a simple way to save information from your website via forms without having to set up a server\"",
    site: "https://formspark.io/",
    sources: [ { label: "formspark.io/pricing", href: "https://formspark.io/pricing/" }, { label: "API reference", href: "https://documentation.formspark.io/api/reference.html" }, { label: "Webhooks (unsigned)", href: "https://documentation.formspark.io/integration/webhooks.html" } ],
    title: "Postbag vs Formspark: signed routing vs a simple one-time-payment form endpoint",
    description: "Postbag compared with Formspark: pricing model, full API, webhook signing, spam protection, self-hosting, schema versioning, multi-site streams and agent support.",
    lede: "Formspark is a clean, cheap form-to-email endpoint with a one-time price. Postbag trades the flat price for saved-first delivery, signed webhooks, routing and self-hosting.",
    summary: "Formspark has a real form-CRUD API and excellent spam options, and its webhooks are explicitly unsigned. Postbag signs every webhook, records every delivery attempt, routes many forms into one schema, and runs as one container you can host yourself.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "250 submissions, 10 forms (Formspark pricing)" },
      { label: "Entry paid", postbag: PB.paid, them: "One-time bundle: 50,000 submissions / 100 forms (currently $25)" },
      { label: "Management API", postbag: PB.api, them: "Yes: forms CRUD with scoped keys" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Yes, unsigned (\"Formspark does not currently sign webhook requests\")" },
      { label: "Email", postbag: PB.email, them: "Yes" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack" },
      { label: "Spam", postbag: PB.spam, them: "OOPSpam, Botpoison, Turnstile, reCAPTCHA, hCaptcha, honeypot, spam words" },
      { label: "File uploads", postbag: PB.uploads, them: "Via Uploadcare" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No" },
      { label: "Schemas and drift", postbag: PB.schema, them: "No versioned schemas" },
      { label: "Many sites → one destination", postbag: PB.multi, them: "Workspaces and team invites; per-form config" },
      { label: "For AI agents", postbag: PB.agents, them: "No llms.txt, MCP or CLI found" },
    ],
    whenThem: ["You want a flat one-time price for a handful of simple forms.", "You need uploads or a wide choice of captcha providers right now."],
    whenUs: ["Your downstream system must verify that a webhook really came from the form backend.", "You need retries you can see and replay, and a record of every attempt.", "Many forms should map onto one shape for one partner.", "Self-hosting or agent-driven setup matters."],
    faqs: [
      { q: "Does Formspark sign webhooks?", a: "Its documentation says it does not currently sign webhook requests. Postbag signs every webhook and system webhook with HMAC-SHA256 when a secret is configured." },
      { q: "Which is cheaper?", a: "For a small number of forms Formspark's one-time bundle is hard to beat. Postbag's free plan covers 5 forms and 1,000 submissions a month; Pro is $15/month ($12/month billed yearly) and Team is $49/month ($39/month billed yearly)." },
    ],
    checked: "2026-08-21",
  },
  {
    slug: "getform",
    name: "Getform (now Forminit)",
    tagline: "\"A form backend for websites, apps, and AI-built frontends\"",
    site: "https://forminit.com/",
    sources: [ { label: "forminit.com/pricing", href: "https://forminit.com/pricing/" }, { label: "Why Forminit (rename, Jan 2026)", href: "https://forminit.com/docs/why-forminit/" }, { label: "forminit.com/llms.txt", href: "https://forminit.com/llms.txt" } ],
    title: "Postbag vs Getform (Forminit): headless form backend vs a routing form backend",
    description: "Postbag compared with Getform, renamed Forminit in January 2026: free tier, REST API, webhooks, typed validation, spam protection, uploads, self-hosting, multi-site routing and support for AI agents and AI-built frontends.",
    lede: "Getform rebranded to Forminit in January 2026 and positions itself for AI-built frontends (Lovable, Bolt, v0, Cursor). Postbag is built for the agents themselves: the whole product is one API an agent can drive, and every submission is saved before it goes anywhere.",
    summary: "Forminit is a polished headless endpoint with typed server-side field validation and an llms.txt. Postbag adds versioned schemas with drift detection, streams that map many forms onto one contract, signed webhooks with a retryable outbox, and self-hosting.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "100 submissions/month, 1 form (Forminit pricing)" },
      { label: "Entry paid", postbag: PB.paid, them: "Pro $19/month billed yearly" },
      { label: "Management API", postbag: PB.api, them: "REST API on Pro; submit and list-submissions documented, form CRUD not verified" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Yes on Pro; signing not verified" },
      { label: "Email", postbag: PB.email, them: "Yes" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack, Discord" },
      { label: "Spam", postbag: PB.spam, them: "Honeypot, Turnstile, reCAPTCHA, hCaptcha, domain allowlist, rate limits" },
      { label: "File uploads", postbag: PB.uploads, them: "Yes, including free tier" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No" },
      { label: "Schemas and drift", postbag: PB.schema, them: "\"Form Blocks\" typed validation; no versions or drift" },
      { label: "Many sites → one destination", postbag: PB.multi, them: "Workspaces (Business)" },
      { label: "For AI agents", postbag: PB.agents, them: "llms.txt; marketing aimed at AI site builders; no MCP or CLI found" },
    ],
    whenThem: ["You need file uploads on the free tier.", "You want typed per-field validation set up in a UI."],
    whenUs: ["You want schemas that are versioned contracts with drift detection, not just validation.", "Several sites must deliver one shape to one partner, with a window or a digest.", "An agent should be able to create, verify and route the form without a human.", "You need self-hosting."],
    faqs: [
      { q: "Is Getform the same as Forminit?", a: "Yes. Getform was renamed Forminit on 14 January 2026 according to its own documentation." },
      { q: "Does Postbag work with Lovable, Bolt or v0 output?", a: "Yes. Any HTML form or fetch call can post to a Postbag submit URL. The difference is that a coding agent can also create and verify the form through the API instead of a human doing it in a dashboard." },
    ],
    checked: "2026-08-21",
  },
  {
    slug: "basin",
    name: "Basin",
    tagline: "\"a lead-capture platform for the web\" (Basin's llms.txt)",
    site: "https://usebasin.com/",
    sources: [ { label: "usebasin.com/pricing", href: "https://usebasin.com/pricing" }, { label: "API reference", href: "https://docs.usebasin.com/developer-features/api-reference/" }, { label: "Webhooks (signed)", href: "https://docs.usebasin.com/integrations/webhooks/" } ],
    title: "Postbag vs Basin: routing form backend vs lead-capture platform",
    description: "Postbag compared with Basin (usebasin.com): free tiers, APIs, signed webhooks, spam filters, uploads, agency features, self-hosting, versioned schemas and agent support.",
    lede: "Basin is a mature lead-capture platform with an agency plan, signed webhooks and a full API on its Growth tier. Postbag shares the signed-webhook discipline and adds durable routing, versioned schemas and self-hosting from the first tier.",
    summary: "Basin signs its webhooks and has real projects and an API, which makes it one of the closest comparisons. Postbag's differences are structural: every submission is a row with an outbox, streams map many forms onto one versioned schema, and the whole thing is one self-hostable container that an agent can drive from the free plan.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "1 form, 50 submissions/month, 30-day retention (Basin pricing)" },
      { label: "Entry paid", postbag: PB.paid, them: "Starter $12.50/month billed yearly" },
      { label: "Management API", postbag: PB.api, them: "Forms, submissions, projects, form webhooks (Growth+)" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Yes, signed (X-Basin-Signature, HMAC-SHA256), Growth+" },
      { label: "Email", postbag: PB.email, them: "Yes, plus SMS" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack, Discord" },
      { label: "Spam", postbag: PB.spam, them: "reCAPTCHA v2/v3, hCaptcha, Turnstile, honeypot, duplicate/country/burner-email filters" },
      { label: "File uploads", postbag: PB.uploads, them: "Yes" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No" },
      { label: "Schemas and drift", postbag: PB.schema, them: "Real-time email/phone validation; no versioned schemas" },
      { label: "Many sites → one destination", postbag: PB.multi, them: "Projects, Agency plan, unlimited collaborators" },
      { label: "For AI agents", postbag: PB.agents, them: "llms.txt; AI lead features; no MCP or CLI found" },
    ],
    whenThem: ["You want SMS alerts and lead-qualification features out of the box.", "You need uploads and many captcha options."],
    whenUs: ["You want signed webhooks and an API on the free tier.", "Many forms with different field names must arrive as one schema, with windows and digests.", "You need self-hosting or agent-driven setup."],
    faqs: [
      { q: "Do both sign webhooks?", a: "Yes. Basin uses X-Basin-Signature on its Growth+ tiers; Postbag uses Postbag-Signature (t=…,v1=…) on every plan." },
    ],
    checked: "2026-08-21",
  },
  {
    slug: "web3forms",
    name: "Web3Forms",
    tagline: "\"Receive form submissions directly in your email inbox without any server or back-end code\"",
    site: "https://web3forms.com/",
    sources: [ { label: "web3forms.com/pricing", href: "https://web3forms.com/pricing" }, { label: "docs.web3forms.com", href: "https://docs.web3forms.com/" } ],
    title: "Postbag vs Web3Forms: durable routing vs a free-forever email relay",
    description: "Postbag compared with Web3Forms: free tier, API access, webhooks, captcha options, uploads, self-hosting, schemas, multi-site routing and agent support.",
    lede: "Web3Forms is a generous free email relay for static sites. Postbag is a backend: every submission is stored, every delivery is tracked, and everything is driven by one API.",
    summary: "Web3Forms focuses on getting an email without a backend, with a free tier that many sites never outgrow. Postbag keeps the data, routes it, signs webhooks, versions schemas and self-hosts. Different jobs; the comparison is about whether you need the record.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "250 submissions/month, unlimited forms/access keys (Web3Forms pricing)" },
      { label: "Entry paid", postbag: PB.paid, them: "Pro $12/month or $149/year" },
      { label: "Management API", postbag: PB.api, them: "Submissions API documented; form management API not verified" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Yes on Pro; signing not verified" },
      { label: "Email", postbag: PB.email, them: "Yes (the core product)" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack, Discord, Telegram" },
      { label: "Spam", postbag: PB.spam, them: "hCaptcha free; reCAPTCHA/Turnstile on Pro; honeypot" },
      { label: "File uploads", postbag: PB.uploads, them: "Pro" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No (client plugins are open source)" },
      { label: "Schemas and drift", postbag: PB.schema, them: "No" },
      { label: "Many sites → one destination", postbag: PB.multi, them: "Agency and Team plan" },
      { label: "For AI agents", postbag: PB.agents, them: "docs llms.txt; no MCP or CLI found" },
    ],
    whenThem: ["You want email notifications for a static site and nothing else, for free.", "You need Telegram, Slack and Discord today on the free tier."],
    whenUs: ["You need a durable record and a retryable delivery log, not just an email.", "You route to a CRM or partner and need a signed, versioned contract.", "Self-hosting or agent-driven setup matters."],
    faqs: [
      { q: "Is Web3Forms really free forever?", a: "Its pricing page says \"Free for Ever. Only Pay for Extra Features\" with 250 submissions a month on the free tier. Check the page for current limits." },
    ],
    checked: "2026-08-21",
  },
  {
    slug: "netlify-forms",
    name: "Netlify Forms",
    tagline: "\"serverless form handling … without extra API calls or additional JavaScript\"",
    site: "https://docs.netlify.com/manage/forms/setup/",
    sources: [ { label: "Netlify Forms setup", href: "https://docs.netlify.com/manage/forms/setup/" }, { label: "Forms usage and billing", href: "https://docs.netlify.com/manage/forms/usage-and-billing/" }, { label: "Spam filters", href: "https://docs.netlify.com/manage/forms/spam-filters/" } ],
    title: "Postbag vs Netlify Forms: host-independent routing vs forms built into Netlify hosting",
    description: "Postbag compared with Netlify Forms: platform lock-in, free tier limits, API access, webhook signing, spam filtering, uploads, self-hosting, schemas, multi-site routing and agent support.",
    lede: "Netlify Forms is convenient if every site you run is on Netlify. Postbag works with any host, any framework and any agent, and keeps working when a site moves.",
    summary: "Netlify Forms is detected at deploy time and only works on Netlify-hosted sites; its free allowance has historically been the classic pain point (100 submissions/month on legacy plans). Postbag is host-independent, exposes everything through an API, signs webhooks, keeps every submission as a routed row and can be self-hosted.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "Legacy plans: 100 submissions/month + 10 MB uploads; credit-based plans: \"Forms are free and unlimited\" (Netlify docs)" },
      { label: "Entry paid", postbag: PB.paid, them: "Level 1 (1,000 submissions) on legacy plans; price not published in docs" },
      { label: "Management API", postbag: PB.api, them: "Netlify API can read submissions; forms are detected at deploy, no form-management API" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Outgoing POST notifications; JWS-signed when a secret is set" },
      { label: "Email", postbag: PB.email, them: "Yes" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack" },
      { label: "Spam", postbag: PB.spam, them: "Akismet (automatic), honeypot, reCAPTCHA v2" },
      { label: "File uploads", postbag: PB.uploads, them: "Yes, 8 MB per request" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No" },
      { label: "Schemas and drift", postbag: PB.schema, them: "No" },
      { label: "Many sites → one destination", postbag: PB.multi, them: "Per site" },
      { label: "Tied to a host", postbag: PB.lock, them: "Only works on Netlify-hosted sites" },
      { label: "For AI agents", postbag: PB.agents, them: "No forms-specific agent surface found" },
    ],
    whenThem: ["Every site you run is on Netlify and you want zero extra services.", "You need uploads and Akismet with no setup."],
    whenUs: ["Your sites live on different hosts, or might move.", "You need a management API, signed webhooks, or routing across sites.", "An agent is building the site and should wire the form itself.", "You want to self-host."],
    faqs: [
      { q: "Can I use Postbag on a Netlify site?", a: "Yes. Point the form's action at your Postbag submit URL. Postbag does not care where the site is hosted." },
    ],
    checked: "2026-08-21",
  },
]
