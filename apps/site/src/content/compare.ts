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
  api: "Your agent can create, inspect and manage forms from one API",
  webhooks: "Yes; HMAC-signed when a secret is configured, with visible retries",
  email: "Yes (Resend), Reply-To from the submission",
  chat: "Telegram today; Slack and Discord next",
  spam: "Honeypot, rate limits, approved origins and Cloudflare Turnstile; flagged messages stay available to review",
  uploads: "Not yet (text fields only; 256 KB)",
  selfhost: "Yes, the same product you use in the cloud",
  fields: "Keeps changing field names clear and catches surprises before they spread",
  multi: "Keep forms from many sites together, then send each one where it belongs",
  agents: "Your agent can set up, test and manage a form without a browser",
  lock: "None",
}

export const COMPETITORS: Competitor[] = [
  {
    slug: "formspree",
    name: "Formspree",
    tagline: "\"a form backend, API, and email service for HTML & JavaScript forms\"",
    site: "https://formspree.io/",
    sources: [ { label: "formspree.io/plans", href: "https://formspree.io/plans" }, { label: "Verify webhook signatures", href: "https://help.formspree.io/articles/advanced-features/verify-webhook-signatures" }, { label: "The Formspree CLI", href: "https://help.formspree.io/hc/en-us/articles/360053819114-The-Formspree-CLI" } ],
    title: "Postbag vs Formspree: forms that stay put and go where you need them",
    description: "Compare Postbag and Formspree: plans, API access, webhook signing, spam protection, self-hosting, multi-site setup and agent support.",
    lede: "Formspree is a good fit for one site and one inbox. Postbag gives your forms more places to go.",
    summary: "Both accept HTML forms and send email. Formspree keeps its API and webhooks on paid tiers and is closed source. Postbag gives your agent the full setup from the free plan, keeps messages on the record, and can run on your own infrastructure.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "50 submissions/month, unlimited forms, 30-day history; API and uploads not on free (Formspree plans page)" },
      { label: "Entry paid", postbag: PB.paid, them: "Personal from $15/month; API and webhooks from Pro ($30/month) per third-party pricing roundups (vendor page blocks direct fetch)" },
      { label: "Management API", postbag: PB.api, them: "Per-form API keys (read-only and master) on Pro+; `formspree.json` + CLI for form definitions" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Yes on Pro/Business; signed with Formspree-Signature over the time and message body" },
      { label: "Email", postbag: PB.email, them: "Yes" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack, Telegram, Discord (plugins)" },
      { label: "Spam", postbag: PB.spam, them: "Formshield ML, reCAPTCHA, Turnstile, honeypot" },
      { label: "File uploads", postbag: PB.uploads, them: "Yes, paid plans" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No; legacy open-source repo archived 2023" },
      { label: "Keeping fields tidy", postbag: PB.fields, them: "Rules engine on Business; field rules are not kept as numbered releases" },
      { label: "Many sites, one place", postbag: PB.multi, them: "Projects; per-form integrations" },
      { label: "For AI agents", postbag: PB.agents, them: "CLI; no llms.txt or MCP found" },
    ],
    whenThem: ["You want the most established name and a large plugin catalogue.", "You need file uploads today.", "You are happy paying per-site for the API tier."],
    whenUs: ["Several sites should feed one inbox, CRM or partner.", "You want every message and sending attempt kept where you can see it.", "Your agent should set the form up end to end.", "You want to run the same product yourself."],
    faqs: [
      { q: "Is Postbag a Formspree alternative?", a: "Yes. Both give HTML forms somewhere to send messages. Postbag is for teams that want every message kept, more destinations, an agent-run setup, or the option to run it themselves." },
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
    title: "Postbag vs Formspark: signed sending and room to grow",
    description: "Compare Postbag and Formspark: pricing, API access, webhook signing, spam protection, self-hosting, multi-site setup and agent support.",
    lede: "Formspark is a tidy, one-time-price choice for simple forms. Postbag is for forms you want to keep close.",
    summary: "Formspark has a form API and strong spam options, but its webhooks are explicitly unsigned. Postbag can sign them when you configure a secret, keeps sending attempts visible, helps many sites feed one place, and can run on your own infrastructure.",
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
      { label: "Keeping fields tidy", postbag: PB.fields, them: "No tracked history for field rules" },
      { label: "Many sites, one place", postbag: PB.multi, them: "Workspaces and team invites; per-form config" },
      { label: "For AI agents", postbag: PB.agents, them: "No llms.txt, MCP or CLI found" },
    ],
    whenThem: ["You want a flat one-time price for a handful of simple forms.", "You need uploads or a wide choice of captcha providers right now."],
    whenUs: ["The place receiving a message needs to know it really came from your form service.", "You want sending attempts you can see and send again.", "Many forms should feed one partner without manual sorting.", "Self-hosting or agent-run setup matters."],
    faqs: [
      { q: "Does Formspark sign webhooks?", a: "Its documentation says it does not currently sign webhook requests. Postbag signs sending notifications when a secret is configured." },
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
    title: "Postbag vs Getform (Forminit): forms your agent can take care of",
    description: "Compare Postbag and Getform, now Forminit: free tiers, API access, webhooks, spam protection, uploads, self-hosting, multi-site setup and agent support.",
    lede: "Forminit is made for AI-built frontends. Postbag is made for the agent doing the building.",
    summary: "Forminit is a polished endpoint with field validation and an llms.txt. Postbag lets an agent set up and prove a working form, keeps messages on the record, signs outgoing notifications, and can run on your own infrastructure.",
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
      { label: "Keeping fields tidy", postbag: PB.fields, them: "\"Form Blocks\" typed validation; no versions or drift" },
      { label: "Many sites, one place", postbag: PB.multi, them: "Workspaces (Business)" },
      { label: "For AI agents", postbag: PB.agents, them: "llms.txt; marketing aimed at AI site builders; no MCP or CLI found" },
    ],
    whenThem: ["You need file uploads on the free tier.", "You want typed per-field validation set up in a UI."],
    whenUs: ["You want changing field names to stay understandable, not just validated.", "Several sites must feed one partner, on a schedule that suits them.", "Your agent should create, test and connect the form without a human.", "You need self-hosting."],
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
    title: "Postbag vs Basin: form messages that have a place to land",
    description: "Compare Postbag and Basin: free tiers, APIs, webhook signing, spam filters, uploads, agency features, self-hosting and agent support.",
    lede: "Basin is a mature lead-capture platform. Postbag gives your agent the full form setup from the start.",
    summary: "Basin signs webhooks and has projects and an API, which makes it a close comparison. Postbag keeps every message and sending attempt together, lets an agent run the setup from the free plan, and can run on your own infrastructure.",
    rows: [
      { label: "Free tier", postbag: PB.free, them: "1 form, 50 submissions/month, 30-day retention (Basin pricing)" },
      { label: "Entry paid", postbag: PB.paid, them: "Starter $12.50/month billed yearly" },
      { label: "Management API", postbag: PB.api, them: "Forms, submissions, projects, form webhooks (Growth+)" },
      { label: "Webhooks", postbag: PB.webhooks, them: "Yes, signed with X-Basin-Signature, Growth+" },
      { label: "Email", postbag: PB.email, them: "Yes, plus SMS" },
      { label: "Chat destinations", postbag: PB.chat, them: "Slack, Discord" },
      { label: "Spam", postbag: PB.spam, them: "reCAPTCHA v2/v3, hCaptcha, Turnstile, honeypot, duplicate/country/burner-email filters" },
      { label: "File uploads", postbag: PB.uploads, them: "Yes" },
      { label: "Self-hosting / source", postbag: PB.selfhost, them: "No" },
      { label: "Keeping fields tidy", postbag: PB.fields, them: "Real-time email and phone checks; no tracked history for field rules" },
      { label: "Many sites, one place", postbag: PB.multi, them: "Projects, Agency plan, unlimited collaborators" },
      { label: "For AI agents", postbag: PB.agents, them: "llms.txt; AI lead features; no MCP or CLI found" },
    ],
    whenThem: ["You want SMS alerts and lead-qualification features out of the box.", "You need uploads and many captcha options."],
    whenUs: ["You want webhook signing and an API on the free tier.", "Many forms with different field names should arrive neatly in one place, on a schedule that suits you.", "You need self-hosting or agent-run setup."],
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
    title: "Postbag vs Web3Forms: when email is only the beginning",
    description: "Compare Postbag and Web3Forms: free tiers, API access, webhooks, captcha options, uploads, self-hosting, multi-site setup and agent support.",
    lede: "Web3Forms is a generous free email relay. Postbag is for forms you want to keep track of.",
    summary: "Web3Forms gets an email to you without a service to run, and many sites will never need more. Postbag keeps the messages, sends them where they belong, signs notifications, and can run on your own infrastructure.",
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
      { label: "Keeping fields tidy", postbag: PB.fields, them: "No" },
      { label: "Many sites, one place", postbag: PB.multi, them: "Agency and Team plan" },
      { label: "For AI agents", postbag: PB.agents, them: "docs llms.txt; no MCP or CLI found" },
    ],
    whenThem: ["You want email notifications for a static site and nothing else, for free.", "You need Telegram, Slack and Discord today on the free tier."],
    whenUs: ["You want every message and sending attempt kept, not only an email.", "You send messages to a CRM or partner and need to know they came from Postbag.", "Self-hosting or agent-run setup matters."],
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
    title: "Postbag vs Netlify Forms: forms that travel with your site",
    description: "Compare Postbag and Netlify Forms: hosting limits, free tiers, API access, webhooks, spam filtering, uploads, self-hosting and agent support.",
    lede: "Netlify Forms is convenient when every site is on Netlify. Postbag stays with you when a site moves.",
    summary: "Netlify Forms is found at deploy time and only works on Netlify-hosted sites. Postbag works with any host, gives your agent one place to manage forms, signs notifications, keeps messages on the record, and can run on your own infrastructure.",
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
      { label: "Keeping fields tidy", postbag: PB.fields, them: "No" },
      { label: "Many sites, one place", postbag: PB.multi, them: "Per site" },
      { label: "Tied to a host", postbag: PB.lock, them: "Only works on Netlify-hosted sites" },
      { label: "For AI agents", postbag: PB.agents, them: "No forms-specific agent surface found" },
    ],
    whenThem: ["Every site you run is on Netlify and you want zero extra services.", "You need uploads and Akismet with no setup."],
    whenUs: ["Your sites live on different hosts, or might move.", "You need a management API, webhook signing, or routing across sites.", "An agent is building the site and should wire the form itself.", "You want to self-host."],
    faqs: [
      { q: "Can I use Postbag on a Netlify site?", a: "Yes. Point the form's action at your Postbag submit URL. Postbag does not care where the site is hosted." },
    ],
    checked: "2026-08-21",
  },
]
