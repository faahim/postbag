import type { Faq } from "@/lib/seo"
import { API_URL, EXAMPLE, MAX_BODY_KB, RETRY } from "@/config"

export type FeatureSection = { h: string; p: string[]; code?: { lang: string; title?: string; code: string }; list?: string[] }
export type Feature = {
  slug: string
  nav: string
  title: string
  description: string
  lede: string
  definition: string
  sections: FeatureSection[]
  faqs: Faq[]
  related: { href: string; label: string }[]
}

const u = API_URL

export const FEATURES: Feature[] = [
  {
    slug: "routing",
    nav: "Routing and streams",
    title: "Routing: many forms, one shape, any destination",
    description: "Postbag routes form submissions with streams, mappings and routes: group many forms, map their fields onto one versioned schema, and deliver to email, Telegram or webhooks with windows, digests and quality rules.",
    lede: "A route sends a form, or a whole stream of forms, to a destination with rules. Streams are how an operator turns fifteen slightly different contact forms into one contract a partner can rely on.",
    definition: "In Postbag, a route is a link from a source (one form or one stream) to one destination, carrying rules: instant or digest mode, an optional delivery window, and quality filters. A stream is a named group of forms with a shared, versioned output schema; each form in a stream has a mapping from its own field names onto that schema.",
    sections: [
      { h: "Direct routes: the simple case", p: ["Most forms need one thing: an email when someone writes in. A direct route goes form → destination. The quickstart creates one for you; you can add a Telegram or webhook route to the same form at any time. A form can have any number of direct routes and can also belong to streams."] , code: { lang: "bash", title: "POST /v1/routes", code: `curl -X POST ${u}/v1/routes -H "Authorization: Bearer pb_live_…" -d '{\n  "form_id": "${EXAMPLE.form}",\n  "destination_id": "${EXAMPLE.destination}",\n  "mode": { "type": "instant" },\n  "quality": { "exclude_spam": true, "exclude_quarantined": true }\n}'` } },
      { h: "Streams: one output shape for many forms", p: ["A stream has a slug, a name and a current schema version. Forms attach to it either explicitly by id or by selector (tag:vending, project:prj_…). Each attachment, a stream source, carries a mapping.", "The stream schema is the outbound contract: every route on the stream delivers payloads in that shape, stamped with the schema version. Changing it is a deliberate act that creates a new immutable version, emits stream.schema.changed, and re-validates every source mapping."] },
      { h: "Mappings: direct, constant, default", p: ["A mapping says how a form's fields produce the stream's fields. Today it supports direct field references, constants and defaults; expression mappings (JSONata, ADR-005) are planned and currently return a clear expressions_not_enabled error rather than failing silently.", "Unmapped form fields are kept under extras so nothing is lost. A mapping is valid or incomplete; an incomplete mapping (a required stream field with no source) blocks the attachment with a 422 that lists the missing fields, at creation time, to the dashboard and to the agent making the call."], code: { lang: "json", title: "mapping", code: `{\n  "name":    { "from": "fullName" },\n  "company": { "from": "Företag" },\n  "phone":   { "from": "tel", "default": null },\n  "site":    { "const": "kontorsautomat.se" }\n}` } },
      { h: "Rules: windows, digests, quality", p: ["window: { from, until } timestamps. Outside the window a delivery is created with status skipped and reason window, so you can see that it happened and why.", "mode: instant (default) or digest { cron, timezone }. Digest routes group a period's submissions into one delivery per destination, keyed by the unique (route, period) pair, so two workers can never send the same digest twice. Empty periods send nothing.", "quality: exclude_spam and exclude_quarantined, both true by default. Turn them off for a route that should see everything, for example an audit webhook."] },
      { h: "Preview before you commit", p: ["GET /v1/streams/{id}/preview renders recent submissions from each source through the current mappings, so you can see the mapped payload your partner will receive before a single delivery is sent."] },
    ],
    faqs: [
      { q: "Can one form go to several destinations?", a: "Yes. Create several routes from the same form, or attach the form to a stream that has several routes. Each (submission, route) pair becomes exactly one delivery." },
      { q: "What happens to fields the stream schema does not have?", a: "They are kept under <code>extras</code> in the delivered payload. Nothing is dropped silently." },
      { q: "Can a route be limited to a date range?", a: "Yes. Set <code>window.from</code> and/or <code>window.until</code>. Submissions outside the window produce a <code>skipped</code> delivery with reason <code>window</code>." },
      { q: "Do digests respect my timezone?", a: "Yes. A digest route carries a cron expression and an IANA timezone; the default business timezone is the organization's setting." },
    ],
    related: [ { href: "/features/destinations/", label: "Destinations" }, { href: "/features/schemas-and-drift/", label: "Schemas and drift" }, { href: "/use-cases/agencies/", label: "Agencies and fleets" }, { href: "/docs/routing/", label: "Routing docs" } ],
  },
  {
    slug: "never-lose-a-submission",
    nav: "Durable delivery",
    title: "Never lose a submission: a durable outbox, not a best-effort send",
    description: "Every Postbag submission is stored as a database row before anything else, and delivery is an outbox drained by a worker with retries. Spam, rate limits and schema violations are stored with a status, never dropped.",
    lede: "The HTTP 200 is your receipt. Nothing in the write path talks to a third party, and nothing that goes wrong later can reach back and lose what was received.",
    definition: "Postbag's delivery guarantee is structural: a submission is inserted in the same transaction as one delivery row per matching route, and a worker drains those deliveries with bounded retries and a loud dead state. Correctness is carried by unique constraints in Postgres, not by application logic.",
    sections: [
      { h: "The write path makes no network calls", p: [`POST /s/{form} parses the body (up to ${MAX_BODY_KB} KB), runs the cheap checks, validates against the schema if one is enforced, and then does one transaction: insert the submission, plan the deliveries, write the event. Then it responds. The only exception is optional Cloudflare Turnstile verification, which is bounded by a short timeout and fails open into quarantine rather than rejecting.`] },
      { h: "Every outcome is a status", p: ["Honeypot hit: stored as spam. Origin not on the allowlist: stored as quarantined with reason origin_rejected. Over the per-form rate limit: quarantined, reason rate_limited. Schema violation in enforce mode: quarantined, reason schema_violation, plus a drift event. Over your monthly quota: stored and flagged, delivery paused until the plan allows.", "All of them are visible in the inbox and through GET /v1/submissions. Routes exclude spam and quarantined submissions by default, but you decide."] },
      { h: "The outbox and the worker", p: [`Deliveries are rows with status pending, sending, sent, failed, dead or skipped. A worker claims work with SELECT … FOR UPDATE SKIP LOCKED, so several workers are safe by construction. It wakes on LISTEN/NOTIFY the instant a submission lands, and on a 15-second tick regardless: realtime is an accelerator, never the transport.`, `Failures retry with backoff ${RETRY.formula}. After ${RETRY.maxEmail} attempts for email and Telegram and ${RETRY.maxWebhook} for webhooks a delivery goes dead, raises delivery.dead, and shows as an alert. Dead deliveries keep their payload snapshot and can be retried by hand from the dashboard or POST /v1/deliveries/{id}/retry.`] , code: { lang: "sql", title: "what the worker runs", code: `select * from deliveries\n where status in ('pending','failed') and next_attempt_at <= now()\n order by next_attempt_at\n for update skip locked\n limit 50;` } },
      { h: "Invariants the database enforces", list: [
        "submissions (form_id, idempotency_key) is unique: a retried POST never creates a second submission.",
        "deliveries (submission_id, route_id) is unique: one delivery per submission per route.",
        "digests (route_id, period_key) is unique: one digest per period.",
        "form_schemas and stream_schemas (owner, version) are unique and rows are never updated.",
        "Every tenant row carries organization_id; repositories refuse to run without an organization scope.",
      ], p: ["Because these live in Postgres, a crash in the worker, the API or the dashboard cannot produce a duplicate send or a lost row. It can only produce a delay."] },
      { h: "Retention is your policy", p: ["Data is deleted only by explicit user action or by your plan's retention period (90 days on the free plan, 365 on Pro, 730 on Team, effectively unlimited when self-hosted). Test submissions (_test: true) are excluded from quotas."] },
    ],
    faqs: [
      { q: "What does Postbag return when a submission is spam?", a: "The same 200 (or 303 for HTML posts) as any other submission. The submission is stored with status <code>spam</code>; routes skip it by default. Bots learn nothing." },
      { q: "What if my webhook endpoint is down for an hour?", a: "Deliveries fail, back off exponentially up to six hours between attempts, and keep retrying up to 10 times. When your endpoint returns, they are sent with their original payload snapshot." },
      { q: "Can two workers send the same delivery twice?", a: "No. Claims use <code>FOR UPDATE SKIP LOCKED</code> and the (submission, route) pair is unique, so a delivery is owned by one worker at a time." },
      { q: "Is there a queue like Redis or SQS?", a: "No. The outbox table is the queue (ADR-002). It would only be revisited if Postgres contention were measured, which at form-submission volumes it is not." },
    ],
    related: [ { href: "/docs/architecture/", label: "Architecture" }, { href: "/features/spam-protection/", label: "Spam protection" }, { href: "/features/destinations/", label: "Destinations" } ],
  },
  {
    slug: "destinations",
    nav: "Destinations",
    title: "Destinations: email, Telegram and signed webhooks",
    description: "Postbag delivers form submissions to email (with Reply-To from the submission), Telegram bot chats, and HMAC-SHA256-signed webhooks. Each destination can be tested with a sample payload from the API.",
    lede: "A destination is somewhere submissions can go. Destinations are organization-level and reusable across routes, and every one of them can be tested from the API before it is trusted.",
    definition: "Postbag ships three destination types: email, sent through Resend with Reply-To set from the submission; Telegram, a bot message rendered from a template; and webhook, a JSON POST signed with HMAC-SHA256 and retried with backoff. Webhooks are the universal extension point for CRMs, automation tools and your own systems.",
    sections: [
      { h: "Email", p: ["Config: to[], cc[], subject_template (default \"New submission: {{form.name}}\"), from_name. Mail is sent from a Postbag domain with Reply-To set from the submission (settings.reply_to_field, defaulting to the first field that looks like an email), so replying to a notification answers the person who wrote in. Per-organization sending domains are planned for the commercial phase."] },
      { h: "Telegram", p: ["Config: bot_token, chat_id, optional template. Submissions are rendered into an HTML-formatted bot message; values are escaped so a submission cannot inject markup. Create a bot with @BotFather, add it to your chat, and paste the token and chat id."] },
      { h: "Webhook (signed)", p: ["Config: url, optional secret, optional headers. Postbag POSTs JSON with Postbag-Delivery (the delivery id), Postbag-Event (submission.received, digest.ready, …) and, when a secret is set, Postbag-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of \"{t}.{body}\">. 2xx means sent, 410 means the destination disabled itself, anything else retries with backoff up to 10 attempts."], code: { lang: "ts", title: "verify.ts", code: `import { createHmac, timingSafeEqual } from "node:crypto"\n\nexport function verify(secret: string, header: string, rawBody: string, toleranceSec = 300) {\n  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]))\n  const t = Number(parts.t)\n  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false\n  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex")\n  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 ?? ""))\n}` } },
      { h: "Test before you trust", p: ["POST /v1/destinations/{id}/test sends a sample payload through the real adapter and returns the provider's response inline: status code, latency, an excerpt of the body. This is the agent's verification step, and a good habit for humans too."] },
      { h: "What is next", p: ["Slack and Discord incoming webhooks are typed in the API and are the next adapters. Native CRM destinations (for example Dekhval) follow only once the webhook path has shown the pattern, because each native adapter is maintenance forever. Adding a destination type is one file implementing the DestinationAdapter interface: configSchema, redactConfig, test, deliver."] },
    ],
    faqs: [
      { q: "Can I send to Zapier, Make or n8n?", a: "Yes, through a webhook destination. Those tools give you a catch-hook URL; paste it as the webhook URL. Set a secret if the tool lets you verify signatures." },
      { q: "Does the email come from my domain?", a: "Not yet on the hosted product: mail is sent from a Postbag domain with Reply-To set from the submission. Self-hosted installs configure their own Resend domain with <code>MAIL_FROM</code>. Per-organization verified sending domains are on the roadmap." },
      { q: "How do I verify a webhook signature?", a: "Compute HMAC-SHA256 over <code>{t}.{rawBody}</code> with your secret, compare to <code>v1</code> in constant time, and reject timestamps older than your tolerance. See the <a href='/docs/webhooks/'>webhook docs</a> for code." },
    ],
    related: [ { href: "/docs/webhooks/", label: "Webhook signatures" }, { href: "/features/routing/", label: "Routing" }, { href: "/docs/destinations/", label: "Destination docs" } ],
  },
  {
    slug: "schemas-and-drift",
    nav: "Schemas and drift",
    title: "Schemas and drift: know what your forms actually send",
    description: "Postbag form schemas are immutable versions with observe, enforce and managed modes. Drift detection tells you when a site starts sending different fields; inference proposes a schema from what is arriving.",
    lede: "A form schema is a versioned declaration of what a form collects. You never have to write one, but when you run many sites you want to know the moment one of them changes.",
    definition: "A Postbag form schema is an immutable, versioned JSON Schema (draft 2020-12) plus UI hints. Forms run in observe mode (accept everything, detect drift), enforce mode (validate; violations are quarantined, never dropped) or managed mode (Postbag owns the schema and serves it at /s/{id}/schema so the site renders the form from it).",
    sections: [
      { h: "Three modes, one default", p: ["observe (default): accept everything. If a schema exists, compare each submission to it and raise drift events on differences. If none exists, infer one in the background and offer it as a draft.", "enforce: validate against the current version. Violations are stored as quarantined with reason schema_violation and raise a drift event. Nothing is rejected, nothing is dropped.", "managed: Postbag owns the schema. GET /s/{id}/schema serves it with open CORS and sites render the form from it. The site cannot drift because it has no schema of its own. This is the mode an agent uses when it builds the sixteenth site in a fleet from a stream's template."] },
      { h: "Versions are immutable", p: ["Publishing a schema creates a new row: form_schemas (form_id, version) is unique and rows are never updated. Submissions and deliveries record the version they were validated against, so an old delivery still means what it meant. Stream schemas work the same way and are the outbound contract for every route on the stream."], code: { lang: "bash", title: "publish a version", code: `curl -X POST ${u}/v1/forms/${EXAMPLE.form}/schema -H "Authorization: Bearer pb_live_…" -d '{\n  "json_schema": { "type": "object", "required": ["email"],\n    "properties": { "email": { "type": "string", "format": "email" }, "message": { "type": "string" } } },\n  "ui": { "email": { "label": "Email", "widget": "email", "order": 1 }, "message": { "label": "Message", "widget": "textarea", "order": 2 } },\n  "changelog": "v2: message optional"\n}'` } },
      { h: "Drift", p: ["A drift event records form, submission, kind (new_field, missing_field, type_change) and details, and stays open until someone publishes a new version or dismisses it. GET /v1/forms/{id}/drift lists them; the dashboard shows a \"Change detected\" badge. Organization system webhooks can subscribe to drift.detected, so a CRM or a site factory learns about a change without polling."] },
      { h: "Inference", p: ["For observe forms with no schema, POST /v1/forms/{id}/schema/infer (and the background housekeeping loop) builds a draft from recent submissions: field names, types and which fields were always present. You review and publish it as v1. Inferred versions are flagged as such."] },
    ],
    faqs: [
      { q: "Do I have to define a schema to use Postbag?", a: "No. A form with no schema in observe mode accepts anything. Schemas exist for the people who need them: fleets, partners, and agents that must not produce a form a stream does not understand." },
      { q: "What happens to a submission that violates an enforced schema?", a: "It is stored with status <code>quarantined</code> and reason <code>schema_violation</code>, a drift event is raised, and routes skip it by default. You can publish a compatible schema and retry." },
      { q: "Can a downstream system be notified when a schema changes?", a: "Yes. Subscribe an organization webhook to <code>form.schema.changed</code>, <code>stream.schema.changed</code> or <code>drift.detected</code> under <code>/v1/webhooks</code>." },
    ],
    related: [ { href: "/features/routing/", label: "Routing and streams" }, { href: "/docs/schemas/", label: "Schema docs" }, { href: "/use-cases/ai-built-websites/", label: "AI-built websites" } ],
  },
  {
    slug: "spam-protection",
    nav: "Spam protection",
    title: "Spam protection that stores, flags and never deletes",
    description: "Postbag fights form spam with a honeypot, per-form rate limits, origin allowlists and optional Cloudflare Turnstile. Suspicious submissions are stored with a status, excluded from routes by default, and reversible.",
    lede: "Defence in depth, none of it destructive. Spam is a label you can see and flip, not a bin you cannot open.",
    definition: "Postbag's spam protection layers a honeypot field (_gotcha by default), a per-form, per-IP token-bucket rate limit, an origin allowlist, optional Cloudflare Turnstile verification and a heuristic score. Every outcome is stored with a status (received, spam or quarantined) and routes exclude spam and quarantined submissions unless told otherwise.",
    sections: [
      { h: "Honeypot", p: ["Every form has a honeypot field, _gotcha unless you rename it in settings.honeypot_field. Add it to your form hidden from humans; anything that fills it is stored as spam and routed nowhere. The bot sees the same 200 as a real visitor."], code: { lang: "html", code: `<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true">` } },
      { h: "Rate limit and origin allowlist", p: ["settings.rate_limit sets per-IP requests per minute with a burst for each form. Overflow is stored as quarantined with reason rate_limited and a 429 is returned with a retry hint, so the data is still there if it was real.", "settings.allowed_origins restricts which sites may post. A post from elsewhere is stored as quarantined with reason origin_rejected. The same list drives CORS for fetch-based submissions. Behind Cloudflare, the real client IP and country are taken from the connection headers."] },
      { h: "Cloudflare Turnstile", p: ["Set settings.turnstile { enabled, secret } and include the cf-turnstile-response field in your form. Postbag verifies the token server-side with a short timeout; a failed or missing token quarantines the submission with reason turnstile_failed. The check fails open into quarantine rather than dropping anything if Cloudflare is unreachable."] },
      { h: "Scores, not verdicts", p: ["Submissions carry spam: { score, reasons[] }. Today the reasons are the honeypot and cheap heuristics; user actions (\"spam\" / \"not spam\") feed future scoring. Routes can include spam by setting quality.exclude_spam to false, useful for an audit webhook that should see everything."] },
    ],
    faqs: [
      { q: "Will spammers know they were caught?", a: "No. Spam and quarantined submissions receive the same response as accepted ones." },
      { q: "Can I recover a real message that was marked spam?", a: "Yes. Spam is a status on a stored row. Change it in the dashboard or through the API and retry the deliveries." },
      { q: "Do I have to use a CAPTCHA?", a: "No. The honeypot and rate limit are on by default; Turnstile is optional per form." },
    ],
    related: [ { href: "/features/never-lose-a-submission/", label: "Durable delivery" }, { href: "/docs/submit-endpoint/", label: "Submit endpoint reference" } ],
  },
  {
    slug: "self-hosting",
    nav: "Self-hosting",
    title: "Self-hosting Postbag: one container, one Postgres",
    description: "Postbag is self-hostable by design: one Docker image (api, worker or both), one Postgres 16 database and a docker-compose file. The hosted product runs the same image. Multi-arch (arm64 and amd64).",
    lede: "The hosted product is the same image with billing turned on. No feature may depend on a cloud-only service without a self-host path; that is a principle, not a roadmap item.",
    definition: "Self-hosted Postbag runs as a single container with POSTBAG_ROLE set to api, worker or all, against Postgres 16. Migrations can run on boot (MIGRATE_ON_BOOT=true), health is exposed at /health, email goes through your own Resend domain, and signups can be disabled for a single-organization install.",
    sections: [
      { h: "What you need", list: ["Docker (the image is multi-arch: arm64 and amd64, Alpine-based).", "Postgres 16 (the compose file starts one).", "A Resend API key and a verified sending domain for email destinations. Telegram and webhooks need nothing else.", "A public URL for APP_URL, so submit URLs, embed snippets and docs links are correct."], p: [] },
      { h: "Environment", p: ["DATABASE_URL, APP_URL, BETTER_AUTH_SECRET, POSTBAG_ROLE (api | worker | all), PORT (3000), TZ, MIGRATE_ON_BOOT, RESEND_API_KEY, MAIL_FROM. Run api and worker as two containers from the same image if you want to scale them separately; several workers are safe because delivery claims use FOR UPDATE SKIP LOCKED."] },
      { h: "Security posture", p: ["API keys are hashed (SHA-256) at rest, shown once, and scoped (manage, read, submit). Every tenant table carries organization_id and repositories require an organization scope. Row-level security policies and a postbag_app database role ship in the migrations as a second fence; owners of self-hosted databases are deliberately exempt so a non-superuser install still works. Health at /health reports database status, worker heartbeat and the oldest pending delivery age."] },
      { h: "What is different from the hosted product", p: ["Nothing in features. Plan limits are effectively unlimited under the selfhost plan. You bring your own email domain. Billing does not exist."] },
    ],
    faqs: [
      { q: "Is Postbag open source?", a: "Yes. The server is AGPL-3.0 and the client packages (SDK, CLI, MCP server) are MIT. Self-hosting parity is designed in from the start (one image, one database, no cloud-only dependencies). The source is public at github.com/faahim/postbag." },
      { q: "Can I run the API and the worker separately?", a: "Yes. Start two containers from the same image with <code>POSTBAG_ROLE=api</code> and <code>POSTBAG_ROLE=worker</code>. Several workers are safe." },
      { q: "Do I need Redis or a queue?", a: "No. Postgres is the only stateful dependency; the deliveries table is the queue." },
    ],
    related: [ { href: "/docs/self-hosting/", label: "Self-host guide" }, { href: "/docs/architecture/", label: "Architecture" }, { href: "/pricing/", label: "Pricing" } ],
  },
]
