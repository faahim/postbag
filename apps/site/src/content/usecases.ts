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
    title: "Contact forms for any website",
    description: "Give your site a form address, a helpful inbox, and an email you can reply from. Postbag works with a portfolio, a WordPress theme, a static site, or an app.",
    lede: "Someone likes your site and writes to you. Postbag keeps the message safe and gets it to you without a server to look after.",
    sections: [
      { h: "Set up", p: ["Name the form, choose an email, and paste in the snippet. Or hand the setup to your agent and come back to a working form."] , code: { lang: "html", title: "contact.html", code: `<form action="${u}/s/${EXAMPLE.form}" method="POST">\n  <label>Email<input type="email" name="email" required /></label>\n  <label>Message<textarea name="message" required></textarea></label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <input type="hidden" name="_redirect" value="https://example.com/thanks" />\n  <button type="submit">Send</button>\n</form>` } },
      { h: "A message you can find", p: ["You get an email for every message, where Reply reaches the person who wrote it. Your inbox keeps what arrived, including anything the spam trap caught. Visitors go straight to your thank-you page."] },
      { h: "When the site grows", p: ["Add Telegram for your phone or send leads to your CRM. Let only your own site use the form, or add a bot check when you need one. Your existing HTML can stay put."] },
    ],
    faqs: [ { q: "Do I need JavaScript?", a: "No. A plain HTML form works and redirects after it is sent. JavaScript is optional." }, { q: "Will I get spam?", a: "The spam trap and rate limit are on by default. We keep caught messages out of your email, and you can review them when you need to." } ],
    related: [ { href: "/docs/quickstart/", label: "Quickstart" }, { href: "/features/spam-protection/", label: "Spam protection" } ],
  },
  {
    slug: "agencies",
    nav: "Agencies and fleets",
    title: "Forms for agencies and site fleets",
    description: "Bring forms from client sites into one tidy place for each client or partner. Your agent can handle the setup, even when every site asks its questions a little differently.",
    lede: "Fifteen sites. Fifteen slightly different forms. One partner who needs one tidy place to look. That is a perfectly normal Tuesday.",
    sections: [
      { h: "One place for each client", p: ["Give each client their own project, then let your agent bring the right forms together for the people who need them. The fields can differ from site to site. The result still arrives in a shape people can use."] , code: { lang: "bash", title: "What your agent sends", code: `curl -X POST ${u}/v1/streams -H "Authorization: Bearer pb_live_…" -d '{\n  "name": "Vending leads", "slug": "vending-leads",\n  "schema": { "json_schema": { "type": "object", "required": ["name","phone"],\n    "properties": { "name": {"type":"string"}, "company": {"type":"string"}, "phone": {"type":"string"}, "message": {"type":"string"}, "site": {"type":"string"} } } },\n  "sources": [ { "selector": "tag:vending", "mapping": { "name": {"from":"fullName"}, "phone": {"from":"tel"}, "site": {"const":"fleet"} } } ]\n}'` } },
      { h: "Campaigns stay tidy", p: ["Let a partner receive leads only while a campaign is running. Your ops inbox can get one tidy email at 08:00 with the day's leads. When plans change, update it once instead of visiting fifteen sites."] },
      { h: "Add the next site", p: ["When the next site is built, your agent can give it a form that already fits the rest of the fleet. Future agents find a small note in the repo and know where the form belongs."] },
      { h: "Know when a form changes", p: ["When a site adds a field, Postbag lets you know. When a partner needs a new field, your agent can update the shared setup before anyone is surprised weeks later."] },
    ],
    faqs: [ { q: "Can each client see only their own forms?", a: "Today an agency usually runs one organization with a project for each client. Team roles and invitations are on the commercial roadmap." }, { q: "Can I send leads to a partner only during a campaign?", a: "Yes. Set a start and end time. Outside that time, the lead remains visible to you, so you can always see what happened." } ],
    related: [ { href: "/features/routing/", label: "Where your forms can go" }, { href: "/features/schemas-and-drift/", label: "Keeping forms in step" } ],
  },
  {
    slug: "lead-routing",
    nav: "Lead routing",
    title: "Send leads where they need to go",
    description: "Send website leads to your CRM, a partner, and your team. Get a Telegram alert for sales, a daily note for ops, and a clear record when something needs attention.",
    lede: "A lead is worth money. Keep it first, send it where it needs to go, and do not lose the thread when something is down.",
    sections: [
      { h: "Send it where it matters", p: ["One lead can go to a few places at once. Your CRM gets the details, sales gets a Telegram ping, and ops gets the morning note. You can see what happened at every stop."] },
      { h: "When the CRM is down", p: ["If your CRM is down all weekend, the lead is still here on Monday. We keep trying to send it. If it cannot get through, you get a clear alert and can send it again with one click."] },
      { h: "Keep spam from sales", p: ["Spam stays away from sales by default. You can choose to include it when an audit needs the full picture, but it never slips in by accident."] },
      { h: "Campaigns and daily notes", p: ["Set a campaign's dates once. Ask for a morning summary at 08:00 in your own timezone. One daily note means one daily note, not a busy inbox full of near-duplicates."] , code: { lang: "bash", title: "What your agent sends", code: `curl -X POST ${u}/v1/routes -H "Authorization: Bearer pb_live_…" -d '{\n  "stream_id": "${EXAMPLE.stream}", "destination_id": "${EXAMPLE.destination}",\n  "mode": { "type": "digest", "cron": "0 8 * * *", "timezone": "Europe/Stockholm" }\n}'` } },
    ],
    faqs: [ { q: "Can I see whether a lead reached the CRM?", a: "Yes. You can see whether each send arrived and what the CRM said. When someone asks whether a lead came through, you can answer from the dashboard or the API." }, { q: "What CRMs are supported?", a: "Anything that accepts a webhook, which covers most CRMs. Native integrations will follow where they are genuinely useful." } ],
    related: [ { href: "/features/never-lose-a-submission/", label: "Durable delivery" }, { href: "/docs/webhooks/", label: "Webhook signatures" } ],
  },
  {
    slug: "ai-built-websites",
    nav: "AI-built websites",
    title: "AI-built websites deserve working forms",
    description: "Your agent can set up a working contact form before anyone signs up, prove a test message arrived, and hand it over when you are ready.",
    lede: "If an agent wrote the site, it can wire the form too. It proves the form works first, then hands you the keys.",
    sections: [
      { h: "Start before signup", p: ["An agent can begin before you have an account. It reads /llms.txt, makes a sandbox form, wires the site, and checks that a test message arrived.", "The sandbox lasts 24 hours, keeps up to five test messages, and sends nothing anywhere. It proves the form is ready without pretending an unclaimed form is already live."] , code: { lang: "text", title: "A prompt for your agent", code: `Add a contact Form to this site. Use Postbag: read ${u}/llms.txt,\ncreate a sandbox Form with POST /v1/public/sandboxes, wire the returned snippet,\nsend one test Submission and verify durable receipt. Write postbag.json with the Form id and submit URL.\nDo not ask me to sign up until the Form is working.` } },
      { h: "Claim it when it is ready", p: ["When the form is worth keeping, sign in and claim it. Its address stays the same, and its test messages come with it.", "Then your agent chooses where new messages should go, sends one more test, and checks the result. The proof and the setup stay one continuous story."] },
      { h: "Already signed in?", p: ["Your agent can create the form, choose an email, and set up sending in one go. It gets the snippets and a short checklist to confirm everything is in place."] },
      { h: "Made for agents", p: ["When an agent needs help, every error includes a hint and a docs link. Each setup step points to the next one. Running the same setup again is safe, and a fleet template keeps new sites aligned."] },
      { h: "For site factories", p: ["A site factory can give every new site a form that already fits the rest of the fleet. A small note in each repo tells future agents where the form lives and what to do with it."] },
    ],
    faqs: [ { q: "Can the sandbox send email before I claim it?", a: "No. A sandbox keeps test messages for 24 hours and sends nothing anywhere. Claim the form first, then turn on sending. That order is deliberate." }, { q: "Does Postbag have an MCP server?", a: "Yes. <code>npx -y @postbag/mcp</code> lets an agent use Postbag directly. Agents without MCP can use the documented HTTP API instead." }, { q: "Which agents has this been tested with?", a: "Postbag's own release test gives a fresh Claude Code session a new repo and asks it to ship a working contact form with email and Telegram. Any agent that can make an HTTP request can use Postbag." } ],
    related: [ { href: "/for-ai-agents/", label: "For AI agents" }, { href: "/docs/agents/", label: "Agent guide" } ],
  },
  {
    slug: "static-sites",
    nav: "Static sites and JAMstack",
    title: "Forms for static sites",
    description: "Give an Astro, Next.js, Hugo, Eleventy, or plain HTML site somewhere for its forms to go. Use a form address, a simple redirect, and the framework pattern that suits your site.",
    lede: "Static hosting does not receive form posts. Postbag does, whichever host you use today or move to tomorrow.",
    sections: [
      { h: "Plain HTML", p: ["Use a standard form action and a redirect. After someone sends a message, they go straight to your thank-you page. No JavaScript or build step required."] },
      { h: "fetch, React, Astro, Next.js", p: ["Choose a snippet for fetch, React, Astro, or Next.js. Next.js can send from the server if you prefer. Browser forms work too, and you choose which sites may use your form."] , code: { lang: "ts", title: "app/actions.ts", code: `"use server"\n\nexport async function submitForm(formData: FormData) {\n  await fetch("${u}/s/${EXAMPLE.form}", { method: "POST", body: formData })\n}` } },
      { h: "Keep your options open", p: ["Postbag works on Cloudflare Pages, Vercel, GitHub Pages, S3, a VPS, or several at once. If you move hosts, the form keeps the same address."] },
    ],
    faqs: [ { q: "Does Postbag work with Astro?", a: "Yes. Use the HTML snippet for zero JavaScript, or choose the fetch snippet from your form's embed page." }, { q: "Can I keep the submit URL secret?", a: "No. It appears in the HTML by design. That is why your form has a spam trap, rate limit, allowed-site list, and Turnstile when you need it." } ],
    related: [ { href: "/docs/submit-endpoint/", label: "Submit endpoint" }, { href: "/compare/netlify-forms/", label: "vs Netlify Forms" } ],
  },
]
