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
    title: "Routing: every message where it belongs",
    description: "Postbag routes form submissions to email, Telegram and webhooks — instantly or as tidy digests — and can gather many forms into one dependable feed for a partner or a CRM.",
    lede: "A route is a simple promise: when this form hears something, that place finds out.",
    definition: "A route says where a form's messages go — your inbox, Telegram, a webhook — either instantly or as a daily digest. A stream gathers many forms into one feed that always arrives in the same shape, even when the forms themselves are each a little different.",
    sections: [
      { h: "Direct routes: the simple case", p: ["Most forms need one thing: an email when someone writes in. That's a direct route. The quickstart sets one up; add Telegram or a webhook whenever you like."] , code: { lang: "bash", title: "POST /v1/routes", code: `curl -X POST ${u}/v1/routes -H "Authorization: Bearer pb_live_…" -d '{\n  "form_id": "${EXAMPLE.form}",\n  "destination_id": "${EXAMPLE.destination}",\n  "mode": { "type": "instant" },\n  "quality": { "exclude_spam": true, "exclude_quarantined": true }\n}'` } },
      { h: "Streams: one shape for many forms", p: ["A stream is a named feed. Attach forms to it one by one or by tag, and each form gets a small mapping that says how its fields line up with the feed.", "Whoever listens to the stream — a partner, a CRM, a spreadsheet — always receives the same shape. Changing that shape is a deliberate, versioned step, so nothing ever shifts under anyone's feet."] },
      { h: "Mappings: the lining-up", p: ["A mapping is the lining-up itself: this form's fullName is the feed's name, this Swedish site's Företag is everyone else's company. Fields that don't map anywhere are kept under extras — nothing is quietly lost.", "And if a mapping is incomplete, Postbag says so the moment you attach the form, with a list of exactly what's missing. Not three weeks later, in production."], code: { lang: "json", title: "mapping", code: `{\n  "name":    { "from": "fullName" },\n  "company": { "from": "Företag" },\n  "phone":   { "from": "tel", "default": null },\n  "site":    { "const": "kontorsautomat.se" }\n}` } },
      { h: "Rules: instant, digest, quiet hours", p: ["A route can send things the moment they arrive, or bundle a whole day into one tidy digest — your schedule, your timezone. An empty day simply sends nothing.", "A route can also have a window. Outside it, messages are visibly skipped with the reason written down — you can always see what happened and why.", "And spam never rides along by default. Turn that off only for a route that genuinely should see everything, like an audit feed."] },
      { h: "Preview before you commit", p: ["Preview shows you exactly what your partner will receive — rendered from real, recent messages — before a single one is sent. No surprises on either end."] },
    ],
    faqs: [
      { q: "Can one form go to several destinations?", a: "Yes. Point several routes at the same form, or put the form in a stream that has several. Each message goes out exactly once per route — never twice." },
      { q: "What happens to fields the stream schema does not have?", a: "They are kept under <code>extras</code> in the delivered payload. Nothing is dropped silently." },
      { q: "Can a route be limited to a date range?", a: "Yes. Give it a window with <code>window.from</code> and/or <code>window.until</code>. Anything outside the window is visibly skipped, with the reason on the record." },
      { q: "Do digests respect my timezone?", a: "Yes. A digest route carries a cron expression and an IANA timezone; the default business timezone is the organization's setting." },
    ],
    related: [ { href: "/features/destinations/", label: "Destinations" }, { href: "/features/schemas-and-drift/", label: "Schemas and drift" }, { href: "/use-cases/agencies/", label: "Agencies and fleets" }, { href: "/docs/routing/", label: "Routing docs" } ],
  },
  {
    slug: "never-lose-a-submission",
    nav: "Durable delivery",
    title: "Never lose a submission: saved first, sent second",
    description: "Postbag saves every form submission before it tries to send it anywhere. Spam, rate limits and failed sends are stored with a status and retried on the record — never dropped.",
    lede: "The moment your form gets its answer, the message is already saved. Nothing that goes wrong afterwards — an email outage, a crashed server, a bad deploy — can reach back and lose it.",
    definition: "Saving a message and planning where it goes happen together, as one step, before anything else. Sending comes after, with patient retries, every attempt written down. The rules that make this true live in the database itself, not in hopeful code.",
    sections: [
      { h: "Saving comes before everything", p: [`When a message arrives, Postbag runs its checks, saves it, plans its deliveries and answers — all before talking to a single third party. Messages up to ${MAX_BODY_KB} KB are welcome.`] },
      { h: "Every outcome is kept, with a label", p: ["A honeypot catch is stored as spam. A post from an unfamiliar site is set aside and labeled. Over the rate limit? Set aside, labeled. Over your monthly quota? Still stored — sending just waits until there's room.", "All of it stays visible in your inbox and through the API. Routes skip the spam by default, but that's your call, not ours."] },
      { h: "Sending is patient", p: [`Each message queues its own deliveries, and a sender works through them — instantly, with a steady tick as backstop. Several senders never step on each other; the query below is how they take turns.`, `A failed send retries with growing pauses — ${RETRY.maxEmail} attempts for email and Telegram, ${RETRY.maxWebhook} for webhooks. Still stuck? It goes "dead", loudly, and one click retries it. The message sits safe the whole time.`] , code: { lang: "sql", title: "what the worker runs", code: `select * from deliveries\n where status in ('pending','failed') and next_attempt_at <= now()\n order by next_attempt_at\n for update skip locked\n limit 50;` } },
      { h: "Rules the database itself enforces", list: [
        "submissions (form_id, idempotency_key) is unique — an impatient double-click can never create a duplicate.",
        "deliveries (submission_id, route_id) is unique — you never get the same email twice.",
        "digests (route_id, period_key) is unique — one digest per period means exactly one.",
        "form_schemas and stream_schemas (owner, version) are unique and never rewritten — old records keep meaning what they meant.",
        "organization_id is required on every row — your data is fenced off from everyone else's, structurally.",
      ], p: ["These rules live in the database itself, beneath all of Postbag's own code. So a crash anywhere — sender, API, dashboard — can only ever cause a delay. Never a duplicate, never a lost message."] },
      { h: "Deleting is yours alone", p: ["Data leaves only when you delete it, or when your plan's retention window ends (90 days free, a year on Pro, two on Team — effectively forever when you self-host). Test messages don't count against your quota."] },
    ],
    faqs: [
      { q: "What does Postbag return when a submission is spam?", a: "The same 200 (or 303 for HTML posts) as any other submission. The submission is stored with status <code>spam</code>; routes skip it by default. Bots learn nothing." },
      { q: "What if my webhook endpoint is down for an hour?", a: "Deliveries fail, back off exponentially up to six hours between attempts, and keep retrying up to 10 times. When your endpoint returns, they are sent with their original payload snapshot." },
      { q: "Can two workers send the same delivery twice?", a: "No. Claims use <code>FOR UPDATE SKIP LOCKED</code> and the (submission, route) pair is unique, so a delivery is owned by one worker at a time." },
      { q: "Is there a queue like Redis or SQS?", a: "No. Postgres is the only moving part — the deliveries table is the queue. We'd only rethink that if it ever got slow, and at form volumes it doesn't." },
    ],
    related: [ { href: "/docs/architecture/", label: "Architecture" }, { href: "/features/spam-protection/", label: "Spam protection" }, { href: "/features/destinations/", label: "Destinations" } ],
  },
  {
    slug: "destinations",
    nav: "Destinations",
    title: "Destinations: email, Telegram and signed webhooks",
    description: "Postbag delivers form submissions to email (replying goes straight to the sender), Telegram chats, and signed webhooks for everything else. Every destination can be tested before you rely on it.",
    lede: "Somewhere messages go — set up once, used by every form, and always testable before you trust it.",
    definition: "Postbag can send messages three ways today: email, where hitting Reply answers the person who wrote in; Telegram, a message in your chat; and signed webhooks — the door to everything else, from your CRM to your weekend project.",
    sections: [
      { h: "Email", p: ["Config: to[], cc[], subject_template (default \"New submission: {{form.name}}\"), from_name. Mail is sent from a Postbag domain with Reply-To set from the submission (settings.reply_to_field, defaulting to the first field that looks like an email), so replying to a notification answers the person who wrote in. Per-organization sending domains are planned for the commercial phase."] },
      { h: "Telegram", p: ["Config: bot_token, chat_id, optional template. Submissions are rendered into an HTML-formatted bot message; values are escaped so a submission cannot inject markup. Create a bot with @BotFather, add it to your chat, and paste the token and chat id."] },
      { h: "Webhook (signed)", p: ["Config: url, optional secret, optional headers. Postbag POSTs JSON with Postbag-Delivery (the delivery id), Postbag-Event (submission.received, digest.ready, …) and, when a secret is set, Postbag-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of \"{t}.{body}\">. 2xx means sent, 410 means the destination disabled itself, anything else retries with backoff up to 10 attempts."], code: { lang: "ts", title: "verify.ts", code: `import { createHmac, timingSafeEqual } from "node:crypto"\n\nexport function verify(secret: string, header: string, rawBody: string, toleranceSec = 300) {\n  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]))\n  const t = Number(parts.t)\n  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false\n  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex")\n  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 ?? ""))\n}` } },
      { h: "Test before you trust", p: ["One call sends a real sample through the real pipes and shows you exactly what came back — status, timing, response. Agents do this automatically before wiring anything up. It's a good habit for humans too."] },
      { h: "What's next", p: ["Slack and Discord are the next destinations in line. Until then, both already work today through their incoming webhooks — and honestly, that's how most people will keep using them anyway."] },
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
    description: "Postbag notices when a site starts sending different fields and tells you — that's drift detection. Schemas can watch quietly, check arrivals, or be owned by Postbag entirely. You never have to write one by hand.",
    lede: "You never have to write a schema. But when a site quietly starts sending something different, you want to know that morning. Postbag notices for you.",
    definition: "A schema is a description of what a form collects. Postbag can simply watch (the default), check each arrival against it, or own the schema outright so a site can't wander off at all. When something changes anyway, you get told — that's drift.",
    sections: [
      { h: "Three modes, one default", p: ["observe (the default): accept everything, and quietly compare arrivals against what's expected. Differences become drift alerts. No schema yet? Postbag drafts one from what's actually arriving.", "enforce: check each arrival against the current version. Anything that doesn't fit is set aside with a label and an alert — never rejected, never dropped.", "managed: Postbag owns the schema and the site renders its form from it. The site can't drift, because it has nothing to drift from. This is how an agent builds the sixteenth site in a fleet without inventing a seventeenth shape."] },
      { h: "Versions never change under you", p: ["Publishing a schema always creates a new version; old ones are never rewritten. Every message remembers which version it was checked against, so an old record still means exactly what it meant on the day it arrived."], code: { lang: "bash", title: "publish a version", code: `curl -X POST ${u}/v1/forms/${EXAMPLE.form}/schema -H "Authorization: Bearer pb_live_…" -d '{\n  "json_schema": { "type": "object", "required": ["email"],\n    "properties": { "email": { "type": "string", "format": "email" }, "message": { "type": "string" } } },\n  "ui": { "email": { "label": "Email", "widget": "email", "order": 1 }, "message": { "label": "Message", "widget": "textarea", "order": 2 } },\n  "changelog": "v2: message optional"\n}'` } },
      { h: "Drift: the early warning", p: ["When a site adds a field, drops one, or changes a type, Postbag opens a drift alert with the details and keeps it open until you deal with it — a \"Change detected\" badge in the dashboard, an event your other systems can subscribe to. You find out from Postbag, not from a confused partner three weeks later."] },
      { h: "Inference: the schema writes itself", p: ["For forms without a schema, Postbag drafts one from what's actually arriving — field names, types, which fields always show up. You glance at it, publish it, done. Drafts are clearly marked as drafts."] },
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
    description: "Postbag fights form spam with a honeypot, rate limits, origin allowlists and optional Cloudflare Turnstile. Suspicious messages are labeled and kept out of your inbox — never deleted, always reversible.",
    lede: "Defence in depth, none of it destructive. Spam is a label you can see and flip, not a bin you cannot open.",
    definition: "Postbag layers several quiet defences — a hidden trap field for bots, sensible rate limits, a list of sites allowed to post, and optional Turnstile checking. The important part: everything caught is stored with a label, not deleted. A real message marked as spam is one click from being un-marked.",
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
    lede: "The hosted product is the same image with billing turned on. Nothing may depend on a cloud-only service — that's a principle, not a roadmap item.",
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
