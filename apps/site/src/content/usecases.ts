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
    lede: "Someone visits your site, likes what they see, and writes to you. Postbag makes sure that message actually reaches you — three minutes of setup, no server.",
    sections: [
      { h: "Set up", p: ["Sign up, name the form, say which email to notify. You get an address for your form and a snippet to paste. Or skip all of that and let your agent do it."] , code: { lang: "html", title: "contact.html", code: `<form action="${u}/s/${EXAMPLE.form}" method="POST">\n  <label>Email<input type="email" name="email" required /></label>\n  <label>Message<textarea name="message" required></textarea></label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <input type="hidden" name="_redirect" value="https://example.com/thanks" />\n  <button type="submit">Send</button>\n</form>` } },
      { h: "What you get", p: ["An email for every message, where hitting Reply answers the person who wrote. An inbox with everything ever received — including what the spam trap caught, just in case. Visitors land back on your thank-you page. And nothing, at all, for you to maintain."] },
      { h: "When it grows", p: ["Add Telegram for your phone. Add a webhook into your CRM. Lock the form so only your own site can post to it, or turn on a proper bot check if the quiet defences ever stop being enough. None of it touches your HTML."] },
    ],
    faqs: [ { q: "Do I need JavaScript?", a: "No. A plain HTML form works and redirects after submit. JavaScript is optional." }, { q: "Will I get spam?", a: "The honeypot and rate limit are on by default. Caught submissions are stored as spam and not emailed; you can review them." } ],
    related: [ { href: "/docs/quickstart/", label: "Quickstart" }, { href: "/features/spam-protection/", label: "Spam protection" } ],
  },
  {
    slug: "agencies",
    nav: "Agencies and fleets",
    title: "Form backend for agencies: many client sites, one inbox per client, one contract per partner",
    description: "Agencies and site fleets use Postbag to gather forms from many client sites into one tidy feed per partner or client — different field names smoothed over, delivered on schedule — without code or a support ticket.",
    lede: "Fifteen sites, fifteen slightly different forms, one partner who wants one tidy feed — and only for the campaign. All of it set up without writing code.",
    sections: [
      { h: "Projects for people, streams for routing", p: ["Projects are folders — one per client, so a human can find things. Streams do the actual gathering: pick forms by tag, give the feed one shape, and hang the deliveries off that."] , code: { lang: "bash", title: "create the stream", code: `curl -X POST ${u}/v1/streams -H "Authorization: Bearer pb_live_…" -d '{\n  "name": "Vending leads", "slug": "vending-leads",\n  "schema": { "json_schema": { "type": "object", "required": ["name","phone"],\n    "properties": { "name": {"type":"string"}, "company": {"type":"string"}, "phone": {"type":"string"}, "message": {"type":"string"}, "site": {"type":"string"} } } },\n  "sources": [ { "selector": "tag:vending", "mapping": { "name": {"from":"fullName"}, "phone": {"from":"tel"}, "site": {"const":"fleet"} } } ]\n}'` } },
      { h: "One partner, one window, one digest", p: ["The partner gets leads only while the campaign runs — that's one rule on the route, not code on fifteen sites. Your ops inbox gets one tidy email at 08:00 with the day's leads. Plans change? Change the rule, once."] },
      { h: "The sixteenth site", p: ["When the next site gets built, its form arrives pre-fitted to the feed. The site factory — or the agent building the site — literally cannot produce a form the feed doesn't understand. This is how Postbag's own sites are made, so we'd notice if it were annoying."] },
      { h: "Change without surprise", p: ["A site adds a field? You get a drift alert. The partner wants a new field? Publish the next version of the shape, and everyone subscribed hears about it the moment it happens. Nobody finds out by accident, weeks later."] },
    ],
    faqs: [ { q: "Can each client see only their own forms?", a: "Organizations are the tenant boundary; team roles and invitations are on the commercial roadmap. Today an agency typically runs one organization with projects per client." }, { q: "Can I deliver to a partner only during a campaign?", a: "Yes: set window.from and window.until on the route. Outside the window, deliveries are created as skipped with reason window, so you can see them." } ],
    related: [ { href: "/features/routing/", label: "Routing and streams" }, { href: "/features/schemas-and-drift/", label: "Schemas and drift" } ],
  },
  {
    slug: "lead-routing",
    nav: "Lead routing",
    title: "Lead routing: send form leads to your CRM, a partner and your team, with rules",
    description: "Route website leads with Postbag: instant signed webhooks into a CRM, Telegram alerts to sales, a daily digest to ops, delivery windows for campaigns, and a durable record of every lead and every delivery attempt.",
    lede: "A lead is worth money. Save it first, send it everywhere it's needed, and keep the record when something was down.",
    sections: [
      { h: "Fan out", p: ["One lead, several places at once: the CRM gets a signed webhook, sales gets a Telegram ping, ops gets the morning digest. Each one is tracked separately, with its own record of what happened."] },
      { h: "When the CRM is down", p: ["The lead waits, safely stored, while we retry — patiently, for hours if we have to. When the CRM comes back, the lead arrives exactly as it was. If it never comes back, you get an alert you cannot miss, and one click sends it again."] },
      { h: "Quality rules", p: ["Spam never reaches sales. That's the default — you'd have to explicitly ask for it, and about the only good reason is an audit feed that should see everything."] },
      { h: "Windows and digests", p: ["A campaign that runs September through December is one rule on the route. A morning summary at 08:00, your timezone, is another. And one digest per day means exactly one — guaranteed, not hoped."] , code: { lang: "bash", title: "digest route", code: `curl -X POST ${u}/v1/routes -H "Authorization: Bearer pb_live_…" -d '{\n  "stream_id": "${EXAMPLE.stream}", "destination_id": "${EXAMPLE.destination}",\n  "mode": { "type": "digest", "cron": "0 8 * * *", "timezone": "Europe/Stockholm" }\n}'` } },
    ],
    faqs: [ { q: "Can I see whether a lead reached the CRM?", a: "Yes. Every delivery keeps its status, its attempts and the CRM's actual answer. When someone asks \"did that lead come through?\", you can answer in seconds — from the dashboard or the API." }, { q: "What CRMs are supported?", a: "Anything that accepts a webhook — which in practice is almost everything. Native integrations come later, once the webhook path has shown which ones people actually want." } ],
    related: [ { href: "/features/never-lose-a-submission/", label: "Durable delivery" }, { href: "/docs/webhooks/", label: "Webhook signatures" } ],
  },
  {
    slug: "ai-built-websites",
    nav: "AI-built websites",
    title: "AI-built websites: leave a working form behind before signup",
    description: "When Claude Code, Cursor, Codex, Lovable, Bolt or v0 builds a website, Postbag lets the agent set up a working form before anyone signs up — wire it, prove messages arrive, then claim it and turn on delivery through one API.",
    lede: "If an agent wrote the site, it should wire the form too. It can prove messages actually arrive first — then hand you the keys.",
    sections: [
      { h: "Start with the sandbox", p: ["An agent with no account and no API key can read /llms.txt and create a sandbox form in one call. Back come the form's permanent address, ready-made snippets, and everything needed to verify. The agent wires the site and proves messages are being stored — before anyone has signed up for anything.", "The sandbox is deliberately quiet: it lasts 24 hours, stores a handful of test messages, and sends nothing anywhere. It proves the form works without pretending an unclaimed form is already production mail."] , code: { lang: "text", title: "prompt to an agent", code: `Add a contact Form to this site. Use Postbag: read ${u}/llms.txt,\ncreate a sandbox Form with POST /v1/public/sandboxes, wire the returned snippet,\nsend one test Submission and verify durable receipt. Write postbag.json with the Form id and submit URL.\nDo not ask me to sign up until the Form is working.` } },
      { h: "Claim it when it's ready", p: ["When the form is worth keeping, you sign in and claim it. The form's id and address stay exactly the same, and the stored test messages come along too.", "Then the agent adds the destination and route, sends one more test, and verifies a real delivery end to end. The proof and the setup stay one continuous story — not two different forms."] },
      { h: "Use quickstart when you already have a key", p: ["Already signed in? One authenticated call creates the form, the email destination and the route together, and hands back the snippets plus a recipe to verify it all. The fast lane for the second form onward."] },
      { h: "Why it works for agents", p: ["Every error comes with a hint and a docs link. Every create says what to do next, with ready-to-send bodies. Re-running a setup is safe by design. And fleet templates mean an agent cannot produce a form the rest of the fleet doesn't understand."] },
      { h: "Site factories", p: ["A factory that forges many sites gives each one a pre-fitted form from the fleet's template, and drops a small note into each repo so future agents know the form is there. Each site is watched for drift; the partner receives one dependable shape."] },
    ],
    faqs: [ { q: "Can the sandbox send email before I claim it?", a: "No. A sandbox stores a handful of test messages for 24 hours and sends nothing anywhere. Claim the form first, then turn on delivery — in that order, on purpose." }, { q: "Does Postbag have an MCP server?", a: "Yes: <code>npx -y @postbag/mcp</code> gives an agent one tool per API operation. The HTTP API underneath is small and fully described by /openapi.json, so agents without MCP just use it directly." }, { q: "Which agents has this been tested with?", a: "Postbag's own release test is a fresh Claude Code session in a brand-new repo shipping a working contact form, with email and Telegram, from nothing but an API key. The surface is plain HTTP, so any agent that can call fetch or curl can use it." } ],
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
