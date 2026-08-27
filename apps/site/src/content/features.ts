import type { Faq } from "@/lib/seo"
import { API_URL, EXAMPLE } from "@/config"

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
    nav: "Where messages go",
    title: "Every message, where it belongs",
    description: "Send messages from your form to your inbox, Telegram, or any service with a URL. Hear about them straight away or collect one tidy daily note.",
    lede: "Pick where you need to hear from people. Postbag keeps the rest orderly.",
    definition: "Your form can write to your inbox, send a note to Telegram, or pass a message to another service. When several sites need to reach the same person, your agent brings them together in one tidy place.",
    sections: [
      { h: "Start with your inbox", p: ["Most forms need one thing: an email when someone writes in. Start there. Add Telegram or another service when the form earns it."], code: { lang: "bash", title: "What your agent sees: add a send rule", code: `curl -X POST ${u}/v1/routes -H "Authorization: Bearer pb_live_…" -d '{\n  "form_id": "${EXAMPLE.form}",\n  "destination_id": "${EXAMPLE.destination}",\n  "mode": { "type": "instant" },\n  "quality": { "exclude_spam": true, "exclude_quarantined": true }\n}'` } },
      { h: "Many sites, one tidy place", p: ["Fifteen sites can all reach one partner or CRM, even when their forms ask slightly different questions. Your agent lines them up; the person receiving them sees one dependable format."] },
      { h: "No surprises tucked away", p: ["An extra answer stays with its message. If a site needs more information before it can join the group, Postbag tells your agent straight away, not weeks into a campaign."], code: { lang: "json", title: "What your agent sees: line up the fields", code: `{\n  "name":    { "from": "fullName" },\n  "company": { "from": "Företag" },\n  "phone":   { "from": "tel", "default": null },\n  "site":    { "const": "kontorsautomat.se" }\n}` } },
      { h: "Your schedule", p: ["Hear about messages as they arrive, collect a daily note, or pause notifications outside a campaign window. An empty day stays quiet. Your messages are still there when you come back."] },
      { h: "Look before you switch it on", p: ["See a recent message exactly as your partner will receive it before you turn anything on. Your agent can do the checking; you get the calm version of the story."] },
    ],
    faqs: [
      { q: "Can one form notify several places?", a: "Yes. Your inbox, Telegram, and another service can all hear about the same message. Each place has its own sending record." },
      { q: "What happens to an extra answer?", a: "It stays with the message. Nothing is quietly thrown away because a form asked one more question." },
      { q: "Can I stop a campaign from sending after a date?", a: "Yes. Set a start and end date. Messages that arrive outside that window stay visible instead of disappearing." },
      { q: "Can I get one summary a day?", a: "Yes. Pick a time and timezone. If nobody wrote in that day, there is nothing to send." },
    ],
    related: [ { href: "/features/destinations/", label: "Where messages can go" }, { href: "/features/schemas-and-drift/", label: "Field changes" }, { href: "/use-cases/agencies/", label: "Agencies and fleets" }, { href: "/docs/routing/", label: "Routing docs" } ],
  },
  {
    slug: "never-lose-a-submission",
    nav: "Saved first",
    title: "Saved first. Sent second.",
    description: "Postbag saves every form message before it tries to send it anywhere. If sending fails, it makes its scheduled attempts, then stays visible for you to retry after recovery.",
    lede: "Someone writes to you at 2am. Your email is having a rough night. On Monday, the message is still there.",
    definition: "A message has a home the moment it arrives. Sending comes after, so an outage is a delay instead of a small disaster.",
    sections: [
      { h: "The message lands first", p: ["Postbag saves a message before it speaks to your inbox, CRM, or anything else. A reply from Postbag means it has somewhere safe to wait."] },
      { h: "Nothing gets quietly binned", p: ["Spam, a message from the wrong site, or a busy form all get a clear label and stay visible. Your inbox stays calm by default, but the record is yours to review."] },
      { h: "Sending is patient", p: ["If an inbox or service is down, Postbag retries with longer pauses. When it comes back in time, the original message is ready to go. If the attempts run out, the send stays clearly marked and easy to retry once it is back."] },
      { h: "Small promises with useful consequences", list: [
        "A reused idempotency key does not create two messages.",
        "Each destination keeps one sending record with its retry count and latest outcome.",
        "A daily note is planned once, with any retries kept on the same record.",
        "An old message keeps the meaning it had when it arrived.",
        "Your messages stay separate from everyone else’s.",
      ], p: ["These are not settings you have to babysit. They are why you can hand a form to an agent, go make dinner, and trust the message will still be there."] },
      { h: "Leaving is your call", p: ["Messages leave when you delete them or when your plan’s storage time ends: 90 days on Free, a year on Pro, two years on Team, and as long as you choose when you self-host. Test messages do not use your monthly allowance."] },
    ],
    faqs: [
      { q: "What happens when a message looks like spam?", a: "It is kept and labelled, but it does not disturb your inbox by default. You can review it later." },
      { q: "What if my receiving service is down?", a: "The message stays in Postbag while it makes its scheduled attempts. If they run out, the send is clearly marked and ready for you to retry once the service is back." },
      { q: "Can a receiving service see a message twice?", a: "Postbag keeps one sending record for each place, including its retry count and latest outcome. A receiving service may see a repeat if it accepts a send but loses its reply." },
      { q: "Do I need extra queue software?", a: "No. Postbag comes with the moving parts it needs. The self-host guide explains the small setup when you want to run it yourself." },
    ],
    related: [ { href: "/docs/architecture/", label: "How it holds up" }, { href: "/features/spam-protection/", label: "Spam protection" }, { href: "/features/destinations/", label: "Where messages can go" } ],
  },
  {
    slug: "destinations",
    nav: "Where messages can go",
    title: "Your inbox, Telegram, or wherever comes next",
    description: "Send messages from your form to email, Telegram, or another service. Test every place before you rely on it.",
    lede: "Set a place up once. Let every form use it when it needs to.",
    definition: "Email, Telegram, and webhooks cover the useful paths today: your inbox, your chat, or another service. Your agent can test each one before a real message depends on it.",
    sections: [
      { h: "Email that answers the right person", p: ["A notification arrives in your inbox. Hit Reply and you are replying to the person who filled in the form, not a no-reply address. Small thing. Important thing."] },
      { h: "Telegram when you are away from your desk", p: ["Send a note into a Telegram chat for a quick heads-up. Postbag keeps it readable, so you do not have to decode a tiny wall of text on your phone."] },
      { h: "A door to the rest of your tools", p: ["Use a webhook for your CRM, Zapier, Make, n8n, or a small thing you built on a Saturday. Add a secret and Postbag gives the receiving service a way to check the message really came from you. If the other side is unavailable, Postbag tries up to 10 times, then leaves the send clear and ready for you to retry after recovery."], code: { lang: "ts", title: "What your agent sees: verify a signed message", code: `import { createHmac, timingSafeEqual } from "node:crypto"\n\nexport function verify(secret: string, header: string, rawBody: string, toleranceSec = 300) {\n  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]))\n  const t = Number(parts.t)\n  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false\n  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex")\n  return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 ?? ""))\n}` } },
      { h: "Test before you trust", p: ["Send a real sample and see what arrives before you switch a form on. Agents do this as part of setup. It is a good habit for humans too."] },
      { h: "More places soon", p: ["Slack and Discord are next in line. Until their native adapters arrive, configure a signed Postbag webhook for services that accept its delivery envelope."] },
    ],
    faqs: [
      { q: "Can I send to Zapier, Make, or n8n?", a: "Yes. Paste in the URL those tools give you. Add a secret when the tool can check that the message came from Postbag." },
      { q: "Does email come from my own domain?", a: "Not on Postbag Cloud yet: messages come from a Postbag address and Reply goes to the person who wrote in. When you self-host, you use your own sending domain." },
      { q: "How does another service know the message came from Postbag?", a: "Add a secret, then use the short verification example in the webhook docs. Your agent can handle the technical check for you." },
    ],
    related: [ { href: "/docs/webhooks/", label: "Webhook docs" }, { href: "/features/routing/", label: "Where messages go" }, { href: "/docs/destinations/", label: "Destination docs" } ],
  },
  {
    slug: "schemas-and-drift",
    nav: "Field changes",
    title: "Know when a form quietly changes",
    description: "Postbag notices when a site begins sending different answers, so you can catch a change before it surprises the person receiving messages.",
    lede: "A site changed one question last night. Better to hear it from Postbag this morning.",
    definition: "Most forms can accept whatever arrives. When several sites need to stay aligned, Postbag watches for changes, lets your agent set the rules, and keeps questionable messages safe for review.",
    sections: [
      { h: "Quiet by default", p: ["Start with a form that accepts messages normally. Postbag watches what arrives and lets you know when the answers begin to change. No form-filling ceremony required."] },
      { h: "Stricter when it matters", p: ["For a group of sites or a partner feed, your agent can set what a form should collect. A message that does not fit is set aside with a clear reason rather than vanishing or confusing the next person in line."] },
      { h: "History that stays understandable", p: ["When you change the agreed questions, earlier messages keep their original context. That makes a small change on a live site much less dramatic."], code: { lang: "bash", title: "What your agent sees: publish field rules", code: `curl -X POST ${u}/v1/forms/${EXAMPLE.form}/schema -H "Authorization: Bearer pb_live_…" -d '{\n  "json_schema": { "type": "object", "required": ["email"],\n    "properties": { "email": { "type": "string", "format": "email" }, "message": { "type": "string" } } },\n  "ui": { "email": { "label": "Email", "widget": "email", "order": 1 }, "message": { "label": "Message", "widget": "textarea", "order": 2 } },\n  "changelog": "v2: message optional"\n}'` } },
      { h: "An early heads-up", p: ["If a site adds a question, drops one, or changes the kind of answer it sends, Postbag raises a clear “Change detected” note. You find out before a partner has to ask what happened."] },
    ],
    faqs: [
      { q: "Do I need to define questions before I use Postbag?", a: "No. A normal form can begin by accepting messages as they come. Rules are there when a group of sites needs to stay aligned." },
      { q: "What happens to a message that does not match the rules?", a: "It is kept aside with the reason, and it does not go out by default. Your agent can adjust the form or the rules, then try again." },
      { q: "Can another service be told about a form change?", a: "Yes. Postbag can notify another service when it notices a change. The agent guide has the exact setup." },
    ],
    related: [ { href: "/features/routing/", label: "Where messages go" }, { href: "/docs/schemas/", label: "Field-change docs" }, { href: "/use-cases/ai-built-websites/", label: "AI-built websites" } ],
  },
  {
    slug: "spam-protection",
    nav: "Spam protection",
    title: "Spam protection that keeps the record",
    description: "Postbag uses a hidden field, sensible limits, site checks, and optional Cloudflare Turnstile. Suspicious messages stay out of your inbox, but never vanish forever.",
    lede: "Spam is a label you can review, not a bin you can never open.",
    definition: "A few quiet defences catch common spam without making real visitors jump through hoops. If something gets caught, it is kept with a reason so you can change your mind.",
    sections: [
      { h: "A quiet trap for bots", p: ["Add one hidden field to your form. People never see it; many bots fill it. Those messages are kept aside while the bot receives the same polite response as anyone else."], code: { lang: "html", title: "What your agent adds to the form", code: `<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true">` } },
      { h: "A little breathing room", p: ["Set a sensible pace for each form and say which sites are allowed to post. A sudden rush or a post from somewhere else is kept aside with a reason instead of landing in your inbox."] },
      { h: "A stronger check when you need it", p: ["Turn on Cloudflare Turnstile for a form that is getting extra attention. If the check cannot be completed, Postbag keeps the message aside rather than throwing it away."] },
      { h: "Useful labels, not permanent verdicts", p: ["You can review what was caught and mark a real message as not spam. Your inbox never sees the noise by default; a full record can include everything when it truly needs to."] },
    ],
    faqs: [
      { q: "Will spammers know they were caught?", a: "No. A caught message gets the same outward response as a normal one." },
      { q: "Can I recover a real message marked as spam?", a: "Yes. It is still there with a label. Change the label and send it on when you are ready." },
      { q: "Do I have to use a CAPTCHA?", a: "No. The hidden field and sensible limits are on by default. Turnstile is optional for a form that needs it." },
    ],
    related: [ { href: "/features/never-lose-a-submission/", label: "Saved first" }, { href: "/docs/submit-endpoint/", label: "Submit docs" } ],
  },
  {
    slug: "self-hosting",
    nav: "Self-hosting",
    title: "Run the same Postbag yourself",
    description: "Postbag is fully open source. Run the same product yourself, with the same features, on your own infrastructure.",
    lede: "Postbag Cloud is the easy door. Self-hosting is the ownership door. They lead to the same product.",
    definition: "Use Postbag Cloud when you do not want server chores. Self-host when you want the whole thing in your own hands. Nothing important is held back either way.",
    sections: [
      { h: "A small, honest setup", p: ["Bring a public URL and an email sending domain. The supplied Compose setup runs on ARM and x86, and the self-host guide walks through the rest without a scavenger hunt."] },
      { h: "Keep your own keys", p: ["Your installation has its own keys, people, and messages. Health information is built in, so you can tell whether Postbag is ready before a form needs it."] },
      { h: "The same product", p: ["Cloud pays for hosting, upgrades, backups, deliverability, and fewer things to think about. Self-hosting gives you the same Postbag without hosted plan limits. You bring your own email domain; billing simply is not part of the picture."] },
    ],
    faqs: [
      { q: "Is Postbag open source?", a: "Yes. The service, dashboard, and site are AGPL-3.0. The SDK, CLI, and MCP server are MIT. The source is public at github.com/faahim/postbag." },
      { q: "Is self-hosting a reduced edition?", a: "No. It is the same product. Postbag Cloud adds operation and convenience, not a locked drawer of features." },
      { q: "Do I need a pile of extra services?", a: "No. The supplied setup is deliberately small. Follow the self-host guide and add your own email provider details." },
    ],
    related: [ { href: "/docs/self-hosting/", label: "Self-host guide" }, { href: "/docs/architecture/", label: "How it holds up" }, { href: "/pricing/", label: "Pricing" } ],
  },
]
