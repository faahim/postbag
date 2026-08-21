import type { Faq } from "@/lib/seo"
import { API_URL, EXAMPLE } from "@/config"

export type UseCase = {
  slug: string; nav: string; title: string; description: string; lede: string
  sections: { h: string; p: string[]; code?: { lang: string; title?: string; code: string } }[]
  faqs: Faq[]; related: { href: string; label: string }[]
}
const u = API_URL

export const USE_CASES: UseCase[] = [
  {
    slug: "contact-form",
    nav: "Contact form",
    title: "Contact form backend for any website: one URL, one email, three minutes",
    description: "Use Postbag as the backend for a contact form on a static site, portfolio, WordPress theme or app: a submit URL, spam protection on by default, an email with Reply-To set, and every message kept in an inbox you can search.",
    lede: "The solo-dev path. You have one form on one site and want an endpoint and an email. You meet exactly one new noun: Form.",
    sections: [
      { h: "Set up", p: ["Sign up, name the form, give the email to notify. You get a submit URL and snippets. Or let an agent do it with POST /v1/quickstart."] , code: { lang: "html", title: "contact.html", code: `<form action="${u}/s/${EXAMPLE.form}" method="POST">\n  <label>Email<input type="email" name="email" required /></label>\n  <label>Message<textarea name="message" required></textarea></label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <input type="hidden" name="_redirect" value="https://example.com/thanks" />\n  <button type="submit">Send</button>\n</form>` } },
      { h: "What you get", p: ["An email per submission with Reply-To set to the sender, so you answer from your mail client. An inbox in the dashboard with every message, including the ones the honeypot caught. A 303 back to your thank-you page for plain HTML, JSON for fetch. Nothing to maintain."] },
      { h: "When it grows", p: ["Add Telegram for the phone. Add a webhook into your CRM. Put an origin allowlist on the form so only your site can post. Turn on Turnstile if the honeypot is not enough. None of this requires touching the HTML."] },
    ],
    faqs: [ { q: "Do I need JavaScript?", a: "No. A plain HTML form works and redirects after submit. JavaScript is optional." }, { q: "Will I get spam?", a: "The honeypot and rate limit are on by default. Caught submissions are stored as spam and not emailed; you can review them." } ],
    related: [ { href: "/docs/quickstart/", label: "Quickstart" }, { href: "/features/spam-protection/", label: "Spam protection" } ],
  },
  {
    slug: "agencies",
    nav: "Agencies and fleets",
    title: "Form backend for agencies: many client sites, one inbox per client, one contract per partner",
    description: "Agencies and site fleets use Postbag to group forms from many sites into streams, normalise their different field names onto one schema, and deliver to each client's inbox, CRM or partner with windows and digests, without code or a support ticket.",
    lede: "The operator's path. Fifteen sites, fifteen slightly different forms, one partner who wants one shape between two dates. Configured without code.",
    sections: [
      { h: "Projects for people, streams for routing", p: ["A project is a folder (a client, a niche). Projects never route. A stream is the routing object: it selects forms by id or by tag (tag:vending, project:prj_…), owns a versioned output schema, and carries a mapping per form. Routes hang off the stream."] , code: { lang: "bash", title: "create the stream", code: `curl -X POST ${u}/v1/streams -H "Authorization: Bearer pb_live_…" -d '{\n  "name": "Vending leads", "slug": "vending-leads",\n  "schema": { "json_schema": { "type": "object", "required": ["name","phone"],\n    "properties": { "name": {"type":"string"}, "company": {"type":"string"}, "phone": {"type":"string"}, "message": {"type":"string"}, "site": {"type":"string"} } } },\n  "sources": [ { "selector": "tag:vending", "mapping": { "name": {"from":"fullName"}, "phone": {"from":"tel"}, "site": {"const":"fleet"} } } ]\n}'` } },
      { h: "One partner, one window, one digest", p: ["A route from the stream to the partner's signed webhook with window { from, until } delivers only inside the campaign. A second route to the ops inbox in digest mode sends one email at 08:00 Europe/Stockholm with the day's leads. Both are rules on the route, not code in fifteen sites."] },
      { h: "The sixteenth site", p: ["POST /v1/forms with from_template: st_… creates a form pre-attached to the stream with a valid mapping and a managed schema served at /s/{id}/schema. A site factory, or the agent building the site, cannot produce a form the stream does not understand. This is how Postbag's own site fleet is provisioned."] },
      { h: "Change without surprise", p: ["When a site adds a field, drift shows up on the form. When the partner wants a new field, publish stream schema v2; every mapping is re-validated and stream.schema.changed goes out to anyone subscribed. Deliveries carry the schema version they conform to."] },
    ],
    faqs: [ { q: "Can each client see only their own forms?", a: "Organizations are the tenant boundary; team roles and invitations are on the commercial roadmap. Today an agency typically runs one organization with projects per client." }, { q: "Can I deliver to a partner only during a campaign?", a: "Yes: set window.from and window.until on the route. Outside the window, deliveries are created as skipped with reason window, so you can see them." } ],
    related: [ { href: "/features/routing/", label: "Routing and streams" }, { href: "/features/schemas-and-drift/", label: "Schemas and drift" } ],
  },
  {
    slug: "lead-routing",
    nav: "Lead routing",
    title: "Lead routing: send form leads to your CRM, a partner and your team, with rules",
    description: "Route website leads with Postbag: instant signed webhooks into a CRM, Telegram alerts to sales, a daily digest to ops, delivery windows for campaigns, and a durable record of every lead and every delivery attempt.",
    lede: "A lead is worth money. It should be stored before it is sent, sent to every system that needs it, and visible if any of those systems was down.",
    sections: [
      { h: "Fan out", p: ["One form (or one stream), several routes: a signed webhook to the CRM, a Telegram message to the sales chat, a digest email to ops. Each (submission, route) is exactly one delivery with its own status, attempts and response."] },
      { h: "When the CRM is down", p: ["The webhook delivery fails, backs off exponentially up to 6 hours between attempts and retries up to 10 times. When the CRM returns, the lead arrives with its original payload snapshot. If it never returns, the delivery goes dead and raises an alert you cannot miss; retry it by hand when fixed."] },
      { h: "Quality rules", p: ["Routes exclude spam and quarantined submissions by default. Keep it that way for the CRM; turn it off for an audit webhook that should see everything. Honeypot hits never reach sales."] },
      { h: "Windows and digests", p: ["A partner campaign from 1 September to 31 December is a window on the route. A morning summary is a digest route with cron 0 8 * * * in the organization's timezone. One digest per period is guaranteed by a unique constraint."] , code: { lang: "bash", title: "digest route", code: `curl -X POST ${u}/v1/routes -H "Authorization: Bearer pb_live_…" -d '{\n  "stream_id": "${EXAMPLE.stream}", "destination_id": "${EXAMPLE.destination}",\n  "mode": { "type": "digest", "cron": "0 8 * * *", "timezone": "Europe/Stockholm" }\n}'` } },
    ],
    faqs: [ { q: "Can I see whether a lead reached the CRM?", a: "Yes. Every delivery records status, attempts, last error and the CRM's response (status, latency, body excerpt). GET /v1/deliveries/{id} or the dashboard." }, { q: "What CRMs are supported?", a: "Any that accepts a webhook. Native adapters come only after the webhook path has shown a pattern." } ],
    related: [ { href: "/features/never-lose-a-submission/", label: "Durable delivery" }, { href: "/docs/webhooks/", label: "Webhook signatures" } ],
  },
  {
    slug: "ai-built-websites",
    nav: "AI-built websites",
    title: "Form backend for AI-built websites: let the agent wire and verify the form",
    description: "When Claude Code, Cursor, Codex, Lovable, Bolt or v0 builds a website, Postbag lets the agent create the form backend, embed it and verify delivery through one API, with llms.txt, OpenAPI, a one-call quickstart and test submissions.",
    lede: "If an agent wrote the site, the agent should wire the form. Postbag makes that a four-call conversation, and leaves the wiring in the repo for the next session.",
    sections: [
      { h: "The flow", p: ["Read /llms.txt. GET /v1/me. POST /v1/quickstart with the site's origin and the owner's email. Drop embed.html (or the framework snippet) into the page. POST a _test submission and poll the delivery id until sent. Write postbag.json. Done, without a dashboard."] , code: { lang: "text", title: "prompt to an agent", code: `Add a contact form to this site. Use Postbag: read ${u}/llms.txt,\ncreate the form with POST /v1/quickstart (origin = this site, notify_email = me),\nembed the returned snippet, verify with a _test submission, and write postbag.json.\nAPI key: pb_live_…` } },
      { h: "Why it works for agents", p: ["Every error has a hint and a docs link. Every create returns next[] with ready-to-send bodies. Idempotency-Key and if_exists: \"return\" make re-runs safe. Ids are self-describing. Schemas and stream templates mean an agent cannot produce a form a fleet does not understand."] },
      { h: "Site factories", p: ["A factory that forges many sites provisions a managed form per site from a stream template and writes postbag.json plus a CLAUDE.md line into each repo. The stream's schema becomes the contract; drift is detected per site; the partner receives one shape."] },
    ],
    faqs: [ { q: "Does Postbag have an MCP server?", a: "Yes: npx -y @postbag/mcp (on npm) exposes one tool per API operation plus postbag_quickstart and postbag_explain. The HTTP API underneath is small and fully described by /openapi.json, so agents without MCP use it directly." }, { q: "Which agents has this been tested with?", a: "Postbag's own Phase 1 exit test is a fresh Claude Code session in a new repo shipping a working contact form with email and Telegram from only an API key. The surface is plain HTTP, so any agent that can call fetch or curl can use it." } ],
    related: [ { href: "/for-ai-agents/", label: "For AI agents" }, { href: "/docs/agents/", label: "Agent guide" } ],
  },
  {
    slug: "static-sites",
    nav: "Static sites and JAMstack",
    title: "Forms for static sites: Astro, Next.js, Hugo, Eleventy, plain HTML",
    description: "Postbag gives static and JAMstack sites a form backend without a server: a submit URL that accepts HTML posts and fetch, framework snippets for Astro, React, Next.js server actions, origin allowlists, redirects, and a durable inbox.",
    lede: "Static hosting has no server to receive a form. Postbag is the server, and it does not care which host you use or whether you move.",
    sections: [
      { h: "Plain HTML", p: ["A <form action> and a _redirect. The post gets a 303 back to your thank-you page. No JavaScript, no build step."] },
      { h: "fetch, React, Astro, Next.js", p: ["GET /v1/forms/{id}/embed returns snippets for each, rendered for your form's fields. Next.js server actions keep the submit URL off the client if you prefer; Astro and React post from the browser with an origin allowlist and CORS handled for you."] , code: { lang: "ts", title: "app/actions.ts", code: `"use server"\n\nexport async function submitForm(formData: FormData) {\n  await fetch("${u}/s/${EXAMPLE.form}", { method: "POST", body: formData })\n}` } },
      { h: "Host-independent", p: ["Netlify Forms only works on Netlify. Postbag works on Cloudflare Pages, Vercel, GitHub Pages, S3, a VPS, or all of them at once, and survives a migration because the form posts to Postbag, not to the host."] },
    ],
    faqs: [ { q: "Does Postbag work with Astro?", a: "Yes. Use the HTML snippet (works with zero JS) or the fetch snippet from /v1/forms/{id}/embed." }, { q: "Can I keep the submit URL secret?", a: "It is not secret by design (it is in the HTML), which is why spam controls live on the form: honeypot, rate limit, origin allowlist and Turnstile." } ],
    related: [ { href: "/docs/submit-endpoint/", label: "Submit endpoint" }, { href: "/compare/netlify-forms/", label: "vs Netlify Forms" } ],
  },
]
