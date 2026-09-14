import { API_URL, EXAMPLE } from "../config"
import type { Faq } from "../lib/seo"

/**
 * The guide library: long-tail "add a form to X, send it to Y" pages.
 * Operating system, registry and voice rubric: tasks/guides-system.md.
 * Prose obeys the guide register in docs/BRAND.md; facts come from config and
 * the live contract only.
 */
export type GuideCode = { lang: string; title?: string; code: string }
export type GuideStep = { h: string; p: string[]; code?: GuideCode; extra?: GuideCode }
export type GuideGotcha = { h: string; p: string }
export type Guide = {
  slug: string
  kind: "framework" | "destination"
  /** Short label for rails and the index. */
  nav: string
  /** Query-shaped page title. */
  title: string
  description: string
  /** ≤ 20 words, guide register. */
  lede: string
  /** The honest prerequisites. */
  needs: string[]
  /** What the reader has at the end. One sentence. */
  outcome: string
  /** e.g. "Next.js 14+, App Router". Stated once, in the needs plane. */
  versionNote?: string
  /** The pairing-adapted one-liner a reader pastes to their agent. */
  agentPrompt: string
  steps: GuideStep[]
  gotchas: GuideGotcha[]
  faqs: Faq[]
  related: { href: string; label: string }[]
  /** Public cloneable example, when one exists for this pairing. Never invent a repo. */
  cloneExample?: { href: string; label: string; p: string }
  published: string
  modified: string
}

const u = API_URL
export const SUBMIT_URL = "YOUR_POSTBAG_SUBMIT_URL"

/** Shared step artifacts, so every guide states the same contract the same way. */
export const SANDBOX_CREATE = {
  lang: "bash",
  title: "Create a Form before you have an account",
  code: `sandbox_json="$(npx postbag --json sandbox create \\\n  --name "Contact" \\\n  --origin "https://example.com")"

submit_url="$(printf '%s\\n' "$sandbox_json" | jq -er '.sandbox.submit_url')"
form_id="$(printf '%s\\n' "$sandbox_json" | jq -er '.sandbox.id')"
sandbox_token="$(printf '%s\\n' "$sandbox_json" | jq -er '.sandbox_token')"
claim_url="$(printf '%s\\n' "$sandbox_json" | jq -er '.claim_url')"

printf 'Submit URL: %s\\nForm ID: %s\\nClaim URL: %s\\nSandbox token: %s\\nReplace YOUR_POSTBAG_SUBMIT_URL in the next snippet with the Submit URL above.\\n' \\
  "$submit_url" "$form_id" "$claim_url" "$sandbox_token"`,
} satisfies GuideCode

export const CURL_TEST = {
  lang: "bash",
  title: "Send one test from your terminal",
  code: `curl --fail --silent --show-error -X POST "$submit_url" \\\n  -H "content-type: application/json" \\\n  -d '{ "email": "you@example.com", "message": "hello from the terminal" }'`,
} satisfies GuideCode

export const SANDBOX_STATUS = {
  lang: "bash",
  title: "See it stored",
  code: `POSTBAG_SANDBOX_TOKEN="$sandbox_token" npx postbag sandbox status`,
} satisfies GuideCode

const SKILL_INSTALL =
  "Install the Postbag skill with `npx skills add faahim/postbag --skill postbag`"

const CLAIM_STEP = {
  h: "Claim it when you're ready",
  p: [
    "The creation response included a claim link. Open it, sign in — Google, GitHub, or an emailed code — and the sandbox becomes a real Form in your own workspace. Same id, same submit URL: the page you just wired needs no edit. Your test messages come along, still marked as tests.",
  ],
} satisfies GuideStep

const DELIVERY_CODE = {
  lang: "bash",
  title: "Connect your inbox, then route the Form to it",
  code: `destination_json="$(curl --fail --silent --show-error -X POST ${u}/v1/destinations \\\n  -H "Authorization: Bearer pb_live_…" \\\n  -H "content-type: application/json" \\\n  -d '{ "type": "email", "config": { "to": ["you@example.com"] } }')"\ndestination_id="$(printf '%s\\n' "$destination_json" | jq -er '.id')"\nroute_body="$(jq -n --arg form_id "$form_id" --arg destination_id "$destination_id" \\\n  '{ form_id: $form_id, destination_id: $destination_id }')"\n\ncurl --fail --silent --show-error -X POST ${u}/v1/routes \\\n  -H "Authorization: Bearer pb_live_…" \\\n  -H "content-type: application/json" \\\n  -d "$route_body"`,
} satisfies GuideCode

function destinationCreateCode(body: string): string {
  return `form_id="fm_YOUR_FORM_ID" # Copy yours from: npx postbag forms list
destination_json="$(curl --fail --silent --show-error -X POST ${u}/v1/destinations \\\n  -H "Authorization: Bearer pb_live_…" \\\n  -H "content-type: application/json" \\\n  -d '${body}')"
destination_id="$(printf '%s\\n' "$destination_json" | jq -er '.id')"

printf 'Destination ID: %s\\n' "$destination_id"`
}

const DESTINATION_TEST = {
  lang: "bash",
  title: "Test the Destination",
  code: `curl --fail --silent --show-error -X POST ${u}/v1/destinations/"$destination_id"/test \\\n  -H "Authorization: Bearer pb_live_…"`,
} satisfies GuideCode

const DESTINATION_ROUTE = {
  lang: "bash",
  code: `route_body="$(jq -n --arg form_id "$form_id" --arg destination_id "$destination_id" \\\n  '{ form_id: $form_id, destination_id: $destination_id }')"

curl --fail --silent --show-error -X POST ${u}/v1/routes \\\n  -H "Authorization: Bearer pb_live_…" \\\n  -H "content-type: application/json" \\\n  -d "$route_body"`,
} satisfies GuideCode

const WEBHOOK_ENVELOPE = {
  lang: "json",
  title: "What Postbag posts (your message rides in data)",
  code: `{\n  "id": "${EXAMPLE.delivery}",\n  "type": "submission.received",\n  "schema_version": 1,\n  "form": { "id": "${EXAMPLE.form}", "name": "Contact" },\n  "data": { "email": "you@example.com", "message": "hello" },\n  "extras": {},\n  "meta": { "received_at": "2026-09-09T12:00:00Z" }\n}`,
} satisfies GuideCode

const ORIGIN_GOTCHA = {
  h: "The origin is part of the deal",
  p: "A sandbox Form only accepts browser posts from the origin you gave at creation. Building locally? Create it with your dev address (say http://localhost:4321) and add your real domain after you claim. Terminal tests carry no origin, so curl always gets through.",
} satisfies GuideGotcha

const FIVE_TESTS_GOTCHA = {
  h: "Five tests, then it wants a decision",
  p: "A sandbox holds five test messages of up to 16 KiB each, for 24 hours, and sends nothing anywhere. That is the rehearsal budget. Claiming makes it permanent; letting it expire costs nothing.",
} satisfies GuideGotcha

export const GUIDES: Guide[] = [
  {
    slug: "html",
    kind: "framework",
    nav: "Plain HTML",
    title: "Add a contact form to any HTML site",
    description:
      "A working HTML contact form with no backend, no build step and no JavaScript. Messages are stored safely, then sent to your inbox.",
    lede: "No backend, no build step, no JavaScript. A form tag, and somewhere real for it to go.",
    needs: [
      "An HTML page you can edit",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A live contact form on the plainest kind of site there is, storing every message and emailing you the new ones.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this site and prove a test submission was stored.`,
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "One command gives you a real Form: an id, a submit URL, and 24 hours to try it honestly. It accepts five test messages, stores them, and sends nothing anywhere — a quiet rehearsal space. Save the token it prints; that response is the only place you'll see it.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Point a form tag at it",
        p: [
          "This is the whole integration. Swap the action for your submit URL and keep the odd hidden input at the bottom — it is a tripwire for spam bots, placed where no person will ever meet it.",
          "That's it. No script tag, no library, nothing to keep updated. When someone presses Send, the browser does what browsers have done since 1995, and this time the message has somewhere to go.",
        ],
        code: {
          lang: "html",
          title: "The form, complete",
          code: `<form action="${SUBMIT_URL}" method="POST">\n  <label>\n    Email\n    <input type="email" name="email" required />\n  </label>\n  <label>\n    Message\n    <textarea name="message" required></textarea>\n  </label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <button type="submit">Send</button>\n</form>`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Fill the form in on your page, or send a test from the terminal if you like receipts. Then ask the sandbox what it holds — you'll see your message, stored, with the time it arrived.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "Sending unlocks after you claim: tell Postbag where your inbox is, then route the Form to it. From then on every new message is saved the moment it arrives and sent right after — and if your inbox has a bad day, the message calmly waits it out.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      {
        h: "The thanks page",
        p: "A plain browser post ends on a small hosted thanks page. To end on your own, add a hidden input named _redirect with the address you want — Postbag walks the visitor there instead.",
      },
      ORIGIN_GOTCHA,
      FIVE_TESTS_GOTCHA,
      {
        h: "Leave the honeypot be",
        p: "The hidden _gotcha input works by staying empty — bots fill it, people never see it. Keep it in the markup, keep it off-screen, and don't rename it.",
      },
    ],
    faqs: [
      {
        q: "Do I need any JavaScript at all?",
        a: "No. A plain form post works with JavaScript disabled. If you later want an inline thank-you instead of a redirect, you can add a small fetch call to the same URL.",
      },
      {
        q: "Where do messages go before I claim the form?",
        a: "Nowhere — and that's the point. They are stored as test messages you can read with the sandbox token. Nothing is emailed or forwarded until you claim and connect an inbox.",
      },
      {
        q: "Can the same form live on several pages?",
        a: "Yes. Any page on the allowed origin can post to the same submit URL. After claiming you can allow more origins.",
      },
      {
        q: "What happens to spam?",
        a: "Messages that trip the honeypot are kept and labelled as spam, not binned. Your inbox stays quiet by default; the record stays yours to review.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/spam-protection/", label: "Spam protection" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    cloneExample: {
      href: "https://github.com/faahim/postbag-html-contact-form",
      label: "Clone this working example",
      p: "If you'd rather start from a finished page than paste the snippet, this little repo is the form above — swap in your submit URL and you're away.",
    },
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "astro",
    kind: "framework",
    nav: "Astro",
    title: "Add a contact form to your Astro site",
    description:
      "A contact form for Astro that ships zero JavaScript: one static component, one submit URL, every message stored before it's sent.",
    lede: "Astro's whole promise is shipping less JavaScript. Your contact form shouldn't be the exception.",
    needs: [
      "An Astro project (a fresh npm create astro is fine)",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A zero-JavaScript contact form that stores every message and emails you — on a site that still ships nothing it doesn't need.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this Astro site and prove a test submission was stored.`,
    versionNote: "Any Astro version; the component is plain HTML",
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "Start with one command and no signup. You get a real Form — an id and a submit URL that will survive into production — plus 24 hours and five test messages to prove it works. Keep the token it prints; it appears once.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Make it a component",
        p: [
          "No frontmatter, no client directive, no island. Because there's nothing to hydrate, Astro renders this to pure HTML and ships not one byte of JavaScript for it — a form that would make a Lighthouse audit smile.",
          "Drop it into any page with an import and a tag. It keeps working if you later turn on view transitions, because a native form post doesn't care about client routing.",
        ],
        code: {
          lang: "astro",
          title: "src/components/ContactForm.astro",
          code: `<form action="${SUBMIT_URL}" method="POST">\n  <label>\n    Email\n    <input type="email" name="email" required />\n  </label>\n  <label>\n    Message\n    <textarea name="message" required></textarea>\n  </label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <button type="submit">Send</button>\n</form>`,
        },
        extra: {
          lang: "astro",
          title: "Any page that wants it",
          code: `---\nimport ContactForm from "../components/ContactForm.astro"\n---\n<ContactForm />`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Run the dev server, fill the form in, press Send. Or test from the terminal — either way, ask the sandbox what it holds and you'll find your message stored, timestamped, waiting.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "After claiming, connect your inbox and route the Form to it. Every new message is saved first, then sent — this site you're reading is an Astro site, its contact form is a Postbag form, and this is exactly how it's wired. Of course it is.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      ORIGIN_GOTCHA,
      {
        h: "Dev server first, origin second",
        p: "Astro's dev server lives at http://localhost:4321 by default. If you created the sandbox with your production domain, browser posts from dev will be refused — create it with the localhost origin while you build.",
      },
      {
        h: "The thanks page",
        p: "A static form post ends on a small hosted thanks page. Prefer your own? Add a hidden input named _redirect with the address, or add a client-side fetch later — same URL either way.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Do I need a client:load directive?",
        a: "No. There is nothing to hydrate. The component is static HTML, which is rather the point of Astro.",
      },
      {
        q: "Does this work with SSR adapters?",
        a: "Yes. The form posts from the browser straight to Postbag, so it behaves the same whether the page was prerendered or server-rendered.",
      },
      {
        q: "Can I show an inline thank-you instead of redirecting?",
        a: "Yes — add a small script that posts the same fields as JSON to the same URL and swaps in a confirmation. The static version keeps working for everyone else.",
      },
      {
        q: "What about spam?",
        a: "The hidden _gotcha input catches naive bots, and anything suspicious is kept and labelled rather than binned. You can review it whenever you like.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/spam-protection/", label: "Spam protection" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    cloneExample: {
      href: "https://github.com/faahim/postbag-astro-contact-form",
      label: "Clone this working example",
      p: "Prefer a folder you can open and run? This Astro example is the same form, already a component, ready to try locally.",
    },
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "nextjs",
    kind: "framework",
    nav: "Next.js",
    title: "Add a contact form to Next.js without an API route",
    description:
      "A Next.js App Router contact form with no API route, no server action and no backend code — messages stored durably and emailed to you.",
    lede: "You were about to write app/api/contact/route.ts. You can close that file.",
    needs: [
      "A Next.js project on the App Router",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A contact form that talks straight to a real backend — one you didn't have to write, deploy, or wake up for.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this Next.js app and prove a test submission was stored.`,
    versionNote: "Next.js 14+, App Router",
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "One command, no signup. It returns a real Form id and submit URL — the same ones you'll ship — plus a 24-hour sandbox that stores up to five test messages and sends nothing. The token in the response appears exactly once; save it.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Write the one component you actually need",
        p: [
          "This is a client component because it holds a little state — which field says what, whether we're mid-send. The directive at the top is the only Next-specific line in the file.",
          "Import it from any server component page, app/contact/page.jsx included. No route handler, no server action, no environment variable: the browser posts straight to Postbag, and your Next app stays a purely front-of-house concern.",
        ],
        code: {
          lang: "jsx",
          title: "app/contact/ContactForm.jsx",
          code: `"use client";\n\nimport { useState } from "react";\n\nexport default function ContactForm() {\n  const [email, setEmail] = useState("");\n  const [message, setMessage] = useState("");\n  const [status, setStatus] = useState("idle");\n\n  async function handleSubmit(event) {\n    event.preventDefault();\n    setStatus("sending");\n    try {\n      const res = await fetch("${SUBMIT_URL}", {\n        method: "POST",\n        headers: { "content-type": "application/json" },\n        body: JSON.stringify({ email, message }),\n      });\n      setStatus(res.ok ? "sent" : "error");\n    } catch {\n      setStatus("error");\n    }\n  }\n\n  if (status === "sent") {\n    return <p role="status">Thanks! Your message has been sent.</p>;\n  }\n\n  return (\n    <form onSubmit={handleSubmit}>\n      <label>\n        Email\n        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />\n      </label>\n      <label>\n        Message\n        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required></textarea>\n      </label>\n      <button type="submit" disabled={status === "sending"}>\n        {status === "sending" ? "Sending…" : "Send"}\n      </button>\n      {status === "error" && <p role="status">Something went wrong. Please try again.</p>}\n    </form>\n  );\n}`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Run next dev, open the page, send yourself something. Or do it from the terminal. Then ask the sandbox what it holds — your message is in there, stored before anything else was allowed to happen to it.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "Claiming unlocks sending. Connect your inbox, route the Form to it, and every new message is saved the moment it arrives, then delivered. If delivery fails, the message doesn't go down with it — it waits, and Postbag retries.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      {
        h: "The directive earns its keep",
        p: 'Without "use client" at the top, the App Router treats the file as a server component and useState throws at build time. It\'s the only Next-specific thing here — the rest is plain React.',
      },
      ORIGIN_GOTCHA,
      {
        h: "JSON posts skip the honeypot",
        p: "The hidden _gotcha field belongs to plain HTML forms. A fetch that sends JSON shouldn't include it — spam checks for JSON submissions use other signals, and a filled honeypot would flag you.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Why not a server action?",
        a: "You can use one — Postbag is just an HTTP endpoint. But a server action means your server handles the message before Postbag stores it. Posting from the browser keeps your app stateless.",
      },
      {
        q: "Does this work in the Pages Router?",
        a: "Yes. Drop the directive and it's an ordinary React component — the fetch doesn't care which router rendered the page.",
      },
      {
        q: "Do I need CORS configuration?",
        a: "No. Postbag answers cross-origin posts for the origins your Form allows, which is why the origin you register matters.",
      },
      {
        q: "What shows up in my inbox?",
        a: "Each new message, with the visitor's address set as reply-to — press Reply and you're answering the person, not a no-reply robot.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/routing/", label: "Where messages go" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    cloneExample: {
      href: "https://github.com/faahim/postbag-next-contact-form",
      label: "Clone this working example",
      p: "If you'd rather clone a working example than write the component by hand, this Next.js app is already wired — drop in your submit URL and send a test.",
    },
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "react",
    kind: "framework",
    nav: "React",
    title: "Add a contact form to a React app without a backend",
    description:
      "A React contact form for SPAs and Vite apps with no backend to deploy: one component, one fetch, every message stored before delivery.",
    lede: "Your React app is static files on a CDN. It can still have a real contact form.",
    needs: [
      "A React app (Vite, CRA, or anything that renders components)",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A contact form in your SPA with the one thing SPAs can't fake — a durable place for messages to land.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this React app and prove a test submission was stored.`,
    versionNote: "React 16.8+ (hooks)",
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "One command stands in for the backend you were told you'd need. It returns a Form id and a submit URL that carry straight through to production, wrapped in a 24-hour sandbox: five test messages, safely stored, nothing sent. The printed token shows up once — keep it.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Write the component",
        p: [
          "One component, three pieces of state, one fetch. While the send is in flight the button politely says so; on success the form steps aside for a confirmation; on failure it says something went wrong and lets the visitor try again — their words still in the boxes, not eaten.",
        ],
        code: {
          lang: "jsx",
          title: "src/ContactForm.jsx",
          code: `import { useState } from "react";\n\nexport default function ContactForm() {\n  const [email, setEmail] = useState("");\n  const [message, setMessage] = useState("");\n  const [status, setStatus] = useState("idle");\n\n  async function handleSubmit(event) {\n    event.preventDefault();\n    setStatus("sending");\n    try {\n      const res = await fetch("${SUBMIT_URL}", {\n        method: "POST",\n        headers: { "content-type": "application/json" },\n        body: JSON.stringify({ email, message }),\n      });\n      setStatus(res.ok ? "sent" : "error");\n    } catch {\n      setStatus("error");\n    }\n  }\n\n  if (status === "sent") {\n    return <p role="status">Thanks! Your message has been sent.</p>;\n  }\n\n  return (\n    <form onSubmit={handleSubmit}>\n      <label>\n        Email\n        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />\n      </label>\n      <label>\n        Message\n        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required></textarea>\n      </label>\n      <button type="submit" disabled={status === "sending"}>\n        {status === "sending" ? "Sending…" : "Send"}\n      </button>\n      {status === "error" && <p role="status">Something went wrong. Please try again.</p>}\n    </form>\n  );\n}`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Render it, type something kind to yourself, press Send. Or test from the terminal. Either way, ask the sandbox what it holds: your message, stored with a timestamp, before anything else got a say.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "Once claimed, connect your inbox and route the Form to it. New messages are saved first and sent second, which is the order you want when your email provider picks a bad afternoon.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      ORIGIN_GOTCHA,
      {
        h: "JSON posts skip the honeypot",
        p: "The hidden _gotcha field is for plain HTML forms. Don't add it to a JSON fetch — a filled honeypot reads as a bot, which is a strange thing to do to yourself.",
      },
      {
        h: "Keep the failure path honest",
        p: "The component leaves the visitor's text in place on error so they can retry. Resist the urge to clear the form on submit — clearing belongs after res.ok, never before.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Does this need any npm package?",
        a: "No. fetch is built into every browser you support, and the component above is the whole integration.",
      },
      {
        q: "Will it work with server-side rendering?",
        a: "Yes. The fetch runs on click, in the browser. Frameworks that render React on the server (Next, Remix) just need the component marked as client code where required.",
      },
      {
        q: "Can I add more fields?",
        a: "Yes — add inputs and include them in the JSON body. Postbag stores what arrives; extra answers stay with the message rather than being dropped.",
      },
      {
        q: "What if the visitor is offline?",
        a: "The fetch fails, the form shows its error line, and their text stays put. Nothing reaches Postbag until the send actually succeeds.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/schemas-and-drift/", label: "Field changes" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "vue",
    kind: "framework",
    nav: "Vue",
    title: "Add a contact form to your Vue 3 app",
    description:
      "A Vue 3 contact form with script setup and no backend: one single-file component, one fetch, every message stored before it's delivered.",
    lede: "Three refs, one handler, and a template that reads like the form it renders.",
    needs: [
      "A Vue 3 project with a build step (Vite is the usual suspect)",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A single-file contact form component whose messages have a durable home and a path to your inbox.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this Vue app and prove a test submission was stored.`,
    versionNote: "Vue 3.2+ (script setup)",
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "No signup first — one command returns a real Form id and submit URL, valid straight into production, inside a 24-hour sandbox that stores five test messages and sends nothing. The token it prints appears once; put it somewhere safe.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Write the single-file component",
        p: [
          "This is Vue at its most pleasant: v-model does the bookkeeping, @submit.prevent spares you the event plumbing, and the whole thing fits in one honest file. While a send is in flight the button says so; success swaps the form for a thank-you; failure says so and keeps the visitor's words in the boxes.",
        ],
        code: {
          lang: "vue",
          title: "src/components/ContactForm.vue",
          code: `<script setup>\nimport { ref } from "vue";\n\nconst email = ref("");\nconst message = ref("");\nconst status = ref("idle");\n\nasync function handleSubmit() {\n  status.value = "sending";\n  try {\n    const res = await fetch("${SUBMIT_URL}", {\n      method: "POST",\n      headers: { "content-type": "application/json" },\n      body: JSON.stringify({ email: email.value, message: message.value }),\n    });\n    status.value = res.ok ? "sent" : "error";\n  } catch {\n    status.value = "error";\n  }\n}\n</script>\n\n<template>\n  <p v-if="status === 'sent'" role="status">Thanks! Your message has been sent.</p>\n  <form v-else @submit.prevent="handleSubmit">\n    <label>\n      Email\n      <input type="email" v-model="email" required />\n    </label>\n    <label>\n      Message\n      <textarea v-model="message" required></textarea>\n    </label>\n    <button type="submit" :disabled="status === 'sending'">\n      {{ status === 'sending' ? 'Sending…' : 'Send' }}\n    </button>\n    <p v-if="status === 'error'" role="status">Something went wrong. Please try again.</p>\n  </form>\n</template>`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Mount it, send yourself a line, or test from the terminal. Then ask the sandbox what it holds — your message is there, stored and timestamped, before anything else happened to it.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "After the claim, connect your inbox and route the Form to it. From then on, saved first, sent second — an outage on the receiving end delays a message rather than losing it.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      ORIGIN_GOTCHA,
      {
        h: "Refs unwrap in templates, not in fetch bodies",
        p: "Inside the template, email means email.value. Inside the script it doesn't — which is why the JSON body reads email.value explicitly. Sending the ref object itself serializes to an empty object and a confusing evening.",
      },
      {
        h: "JSON posts skip the honeypot",
        p: "The hidden _gotcha input belongs to plain HTML forms. A JSON fetch shouldn't include it — filled honeypots read as bots.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Does this work with the Options API?",
        a: "Yes — the fetch doesn't care how the component holds its state. script setup just keeps the file short.",
      },
      {
        q: "Do I need axios?",
        a: "No. The browser's fetch is plenty for one POST, and it's one less dependency to update.",
      },
      {
        q: "Can I validate before sending?",
        a: "The required attributes give you the browser's validation for free. Anything richer can wrap the fetch — Postbag stores whatever finally arrives.",
      },
      {
        q: "What about spam without the honeypot?",
        a: "JSON submissions are checked by other signals, and anything suspicious is kept and labelled rather than deleted. You can always review the record.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/spam-protection/", label: "Spam protection" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "nuxt",
    kind: "framework",
    nav: "Nuxt",
    title: "Add a contact form to your Nuxt site",
    description:
      "A Nuxt contact form with no server route and no plugin: drop one component in components/, and every message is stored before delivery.",
    lede: "Drop one file in components/ and Nuxt does the introductions. No server route required.",
    needs: [
      "A Nuxt 3 or 4 project",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "An auto-registered contact form component whose messages land somewhere durable, with your inbox one route away.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this Nuxt site and prove a test submission was stored.`,
    versionNote: "Nuxt 3+",
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "One command, no account: a real Form id and submit URL — the ones you'll keep — inside a 24-hour sandbox that stores up to five test messages and sends nothing anywhere. Save the token from the response; it isn't shown again.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Add the component — Nuxt finds it",
        p: [
          "Put the file in components/ and it's globally available as ContactForm, no import line anywhere. The explicit ref import from vue is deliberate: Nuxt would auto-import it too, but the file stays honest about what it uses and survives being copied into a plain Vue project.",
          "There's no server/api handler in this guide on purpose. The browser posts straight to Postbag, so your Nitro server never holds a visitor's message it could drop.",
        ],
        code: {
          lang: "vue",
          title: "components/ContactForm.vue",
          code: `<script setup>\nimport { ref } from "vue";\n\nconst email = ref("");\nconst message = ref("");\nconst status = ref("idle");\n\nasync function handleSubmit() {\n  status.value = "sending";\n  try {\n    const res = await fetch("${SUBMIT_URL}", {\n      method: "POST",\n      headers: { "content-type": "application/json" },\n      body: JSON.stringify({ email: email.value, message: message.value }),\n    });\n    status.value = res.ok ? "sent" : "error";\n  } catch {\n    status.value = "error";\n  }\n}\n</script>\n\n<template>\n  <p v-if="status === 'sent'" role="status">Thanks! Your message has been sent.</p>\n  <form v-else @submit.prevent="handleSubmit">\n    <label>\n      Email\n      <input type="email" v-model="email" required />\n    </label>\n    <label>\n      Message\n      <textarea v-model="message" required></textarea>\n    </label>\n    <button type="submit" :disabled="status === 'sending'">\n      {{ status === 'sending' ? 'Sending…' : 'Send' }}\n    </button>\n    <p v-if="status === 'error'" role="status">Something went wrong. Please try again.</p>\n  </form>\n</template>`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Use the form in dev, or send from the terminal. Then read the sandbox back: your message is stored with its arrival time, which is the receipt that matters.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "Claim, connect your inbox, route the Form to it. Every new message is saved on arrival and sent right after — and a flaky receiving inbox becomes Postbag's problem to retry, not your visitor's problem to notice.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      ORIGIN_GOTCHA,
      {
        h: "SSR renders it, the browser runs it",
        p: "Nuxt server-renders the markup, but the fetch only ever runs on click, in the browser. No ClientOnly wrapper, no process.client check — a submit handler is client-side by nature.",
      },
      {
        h: "JSON posts skip the honeypot",
        p: "The hidden _gotcha input is a plain-HTML-form device. Leave it out of JSON fetches — filling a honeypot is how bots get caught, not a thing to imitate.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Should I proxy through a Nitro server route instead?",
        a: "You can, but you'd be adding a hop that can fail while the browser could have posted straight to the place that stores the message.",
      },
      {
        q: "Does this work with nuxt generate?",
        a: "Yes. A fully static Nuxt site posts to Postbag exactly the same way — that's rather the point of not needing your own server.",
      },
      {
        q: "Why import ref if Nuxt auto-imports it?",
        a: "Habit worth keeping: the file works when copied anywhere Vue does, and nobody has to remember what Nuxt quietly provides.",
      },
      {
        q: "Can several pages share the form?",
        a: "Yes — auto-registration means any page can render ContactForm, and they all post to the same Form.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/routing/", label: "Where messages go" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "sveltekit",
    kind: "framework",
    nav: "SvelteKit",
    title: "Add a contact form to SvelteKit — even on adapter-static",
    description:
      "A SvelteKit contact form that works on adapter-static: no form action, no +page.server.js, every message stored before it's sent.",
    lede: "Form actions are lovely — until adapter-static takes the server away. This form never needed one.",
    needs: [
      "A SvelteKit project (any adapter, including static)",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A contact form that survives prerendering, static adapters and CDN hosting, because its backend isn't your problem.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this SvelteKit app and prove a test submission was stored.`,
    versionNote: "Svelte 4 and 5 (the syntax below compiles on both)",
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "One command, no signup: a real Form id and submit URL that carry into production, inside a 24-hour sandbox — five test messages stored, nothing sent. The token prints once. Save it.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Write the component",
        p: [
          "SvelteKit's own answer to forms is an action in +page.server.js — which is exactly the file adapter-static can't have. This component skips the question: plain reactive lets, one fetch, and the on:submit modifier syntax that compiles on Svelte 4 and 5 alike.",
        ],
        code: {
          lang: "svelte",
          title: "src/lib/ContactForm.svelte",
          code: `<script>\n  let email = "";\n  let message = "";\n  let status = "idle";\n\n  async function handleSubmit() {\n    status = "sending";\n    try {\n      const res = await fetch("${SUBMIT_URL}", {\n        method: "POST",\n        headers: { "content-type": "application/json" },\n        body: JSON.stringify({ email, message }),\n      });\n      status = res.ok ? "sent" : "error";\n    } catch {\n      status = "error";\n    }\n  }\n</script>\n\n{#if status === "sent"}\n  <p role="status">Thanks! Your message has been sent.</p>\n{:else}\n  <form on:submit|preventDefault={handleSubmit}>\n    <label>\n      Email\n      <input type="email" bind:value={email} required />\n    </label>\n    <label>\n      Message\n      <textarea bind:value={message} required></textarea>\n    </label>\n    <button type="submit" disabled={status === "sending"}>\n      {status === "sending" ? "Sending…" : "Send"}\n    </button>\n    {#if status === "error"}\n      <p role="status">Something went wrong. Please try again.</p>\n    {/if}\n  </form>\n{/if}`,
        },
        extra: {
          lang: "svelte",
          title: "Any +page.svelte",
          code: `<script>\n  import ContactForm from "$lib/ContactForm.svelte";\n</script>\n\n<ContactForm />`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Run the dev server and send yourself something, or test from the terminal. Then read the sandbox back — the message is stored, timestamped, and hasn't gone anywhere. Which, before you've claimed anything, is exactly right.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "Claim it, point it at your inbox, route the Form. New messages are saved the moment they arrive and sent right after — retry included, at no extra thought.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      {
        h: "Prerendering is fine",
        p: "The component renders to static markup and the fetch happens on click. prerender = true, adapter-static, a CDN — none of them change anything here.",
      },
      ORIGIN_GOTCHA,
      {
        h: "JSON posts skip the honeypot",
        p: "The hidden _gotcha input is for plain HTML forms only. A JSON fetch that fills it looks like a bot — leave it out.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Should I use a form action when I do have a server?",
        a: "If you like progressive enhancement with use:enhance, go ahead — post the fields to Postbag from your action. The static-friendly version above just works everywhere, server or not.",
      },
      {
        q: "Does this compile on Svelte 5?",
        a: "Yes. Files without runes run in legacy mode, where let is reactive and on:submit modifiers work. Migrating to runes later is a local change.",
      },
      {
        q: "Where should the file live?",
        a: "src/lib is the convention, giving you the $lib import alias. Anywhere importable works.",
      },
      {
        q: "What happens if the visitor's network drops?",
        a: "The fetch rejects, the form shows its error line, and their text stays in the fields for a retry. Nothing half-arrives.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/spam-protection/", label: "Spam protection" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "hugo",
    kind: "framework",
    nav: "Hugo",
    title: "Add a contact form to your Hugo site",
    description:
      "A Hugo contact form via one partial: no backend, no JavaScript, no slower builds — every message stored, then emailed to you.",
    lede: "Your site builds in milliseconds. It shouldn't grow a server for one form.",
    needs: [
      "A Hugo site with layouts you can edit",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A contact form as a reusable partial, on a site that still builds in the time it takes to blink.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this Hugo site and prove a test submission was stored.`,
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "One command and no account gets you a real Form: an id, a submit URL, and a 24-hour sandbox that stores up to five test messages without sending a thing. The token in the response is shown once — treat it like a key, because it is one.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Make it a partial",
        p: [
          "Hugo's partials are exactly the right shape for this: the form lives in one file under layouts/partials/, and any template can summon it with one line. It's plain HTML inside — Go templating has nothing to interpolate here, which means nothing to escape and nothing to break.",
        ],
        code: {
          lang: "html",
          title: "layouts/partials/contact-form.html",
          code: `<form action="${SUBMIT_URL}" method="POST">\n  <label>\n    Email\n    <input type="email" name="email" required />\n  </label>\n  <label>\n    Message\n    <textarea name="message" required></textarea>\n  </label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <button type="submit">Send</button>\n</form>`,
        },
        extra: {
          lang: "go-html-template",
          title: "Wherever your contact page's layout wants it",
          code: `{{ partial "contact-form.html" . }}`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Run hugo server, open the page, send yourself a message — or use the terminal. Then ask the sandbox what it holds and find it there, stored, with its arrival time.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "After claiming, connect your inbox and route the Form to it. Messages are saved before they're sent — so the person who wrote to you at 2am is still there on Monday, even if your inbox wasn't.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      {
        h: "The thanks page",
        p: "A plain form post ends on a small hosted thanks page. To send visitors back to your own site, add a hidden input named _redirect with the address you want.",
      },
      ORIGIN_GOTCHA,
      {
        h: "hugo server's origin",
        p: "Local Hugo lives at http://localhost:1313. If your sandbox was created with the production origin, browser posts from dev are refused — create it with the localhost origin while you build, and add the real domain after claiming.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Does this slow down my build?",
        a: "Not measurably. It's one static partial — Hugo renders it like any other markup, and there's no asset pipeline behind it.",
      },
      {
        q: "Can I put the form in Markdown content?",
        a: "Make it a shortcode wrapping the same markup, and it drops into any content file. Partials serve layouts; shortcodes serve content.",
      },
      {
        q: "Do themes get in the way?",
        a: "No. Your project's layouts/partials/ overrides or extends the theme's, so the form survives theme updates.",
      },
      {
        q: "What happens to spam?",
        a: "The hidden _gotcha input catches naive bots; anything caught is stored and labelled rather than deleted, so the record stays complete.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/spam-protection/", label: "Spam protection" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "jekyll",
    kind: "framework",
    nav: "Jekyll · GitHub Pages",
    title: "Add a contact form to Jekyll and GitHub Pages",
    description:
      "A contact form for Jekyll sites on GitHub Pages, where server code isn't allowed: one include, no plugin, every message stored then emailed.",
    lede: "GitHub Pages runs no server code, ever. Your contact form was always going to need a friend.",
    needs: [
      "A Jekyll site — on GitHub Pages or anywhere else",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A contact form that GitHub Pages will happily serve forever, with the receiving end handled somewhere real.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this Jekyll site and prove a test submission was stored.`,
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "GitHub Pages can't run the receiving side, so borrow one: a single command returns a real Form id and submit URL inside a 24-hour sandbox — five test messages stored, nothing sent, no account yet. The token it prints appears once; keep it.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Make it an include",
        p: [
          "Put the form in _includes/ and pull it into any page or layout with one Liquid tag. Liquid scans the file for its own syntax on the way through, finds none — this is plain HTML — and passes it along untouched.",
        ],
        code: {
          lang: "html",
          title: "_includes/contact-form.html",
          code: `<form action="${SUBMIT_URL}" method="POST">\n  <label>\n    Email\n    <input type="email" name="email" required />\n  </label>\n  <label>\n    Message\n    <textarea name="message" required></textarea>\n  </label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <button type="submit">Send</button>\n</form>`,
        },
        extra: {
          lang: "liquid",
          title: "Any page, layout or post",
          code: `{% include contact-form.html %}`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Serve the site locally or push to Pages, then send yourself something — or test from the terminal. Ask the sandbox what it holds: the message is stored with its arrival time, no server of yours involved.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "Claim the Form, connect your inbox, route to it. From then on GitHub serves the page, Postbag keeps the messages, and you read them — a fair division of labour between three parties who are each good at one thing.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      {
        h: "github.io is an origin too",
        p: "If your site lives at username.github.io, that full address is the origin to register — with a custom domain, use that instead. The sandbox honours exactly the origin you gave it.",
      },
      {
        h: "The thanks page",
        p: "A plain form post ends on a small hosted thanks page. Add a hidden input named _redirect pointing at a page of your own site to bring visitors home instead.",
      },
      {
        h: "No plugin required, deliberately",
        p: "GitHub Pages runs Jekyll in safe mode with an allow-list of plugins. This integration is markup only, so safe mode has nothing to object to.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Does this work on GitHub Pages' free tier?",
        a: "Yes. The form is static HTML, which is all Pages ever serves. The storing and sending happen on Postbag's side of the fence.",
      },
      {
        q: "Can I use it in Markdown posts?",
        a: "Yes — the include tag works in posts and pages alike, anywhere Liquid is processed.",
      },
      {
        q: "What about the site.github build pipeline?",
        a: "Nothing changes. No gems, no configuration, no Actions workflow — the build stays exactly as boring as it was.",
      },
      {
        q: "Where do messages wait if my email is down?",
        a: "In Postbag, stored and visible, while sending retries with patience. An outage delays a message; it doesn't lose one.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/spam-protection/", label: "Spam protection" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "eleventy",
    kind: "framework",
    nav: "Eleventy",
    title: "Add a contact form to your Eleventy site",
    description:
      "An Eleventy contact form via one Nunjucks include: no client JavaScript, no plugin, every message stored before it's emailed to you.",
    lede: "Eleventy stays out of your way. Its contact form should have the same manners.",
    needs: [
      "An Eleventy project with an _includes directory",
      "A terminal that can run npx and jq — or an agent that has both",
      "About five minutes",
    ],
    outcome:
      "A contact form as one small include, on a site that still has no build complexity to apologise for.",
    agentPrompt: `${SKILL_INSTALL}, then use it to add a working contact form to this Eleventy site and prove a test submission was stored.`,
    steps: [
      {
        h: "Create the Form before you have an account",
        p: [
          "One command, no signup: a real Form id and submit URL inside a 24-hour sandbox that stores up to five test messages and sends nothing. The token prints once — save it before moving on.",
        ],
        code: SANDBOX_CREATE,
      },
      {
        h: "Make it an include",
        p: [
          "One file in _includes/, one include tag wherever the form should appear. The .njk extension means Nunjucks renders it no matter what language the surrounding template speaks — and since the file is static markup with no front matter, there's nothing for the data cascade to even notice.",
        ],
        code: {
          lang: "njk",
          title: "_includes/contact-form.njk",
          code: `<form action="${SUBMIT_URL}" method="POST">\n  <label>\n    Email\n    <input type="email" name="email" required />\n  </label>\n  <label>\n    Message\n    <textarea name="message" required></textarea>\n  </label>\n  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />\n  <button type="submit">Send</button>\n</form>`,
        },
        extra: {
          lang: "njk",
          title: "Any template",
          code: `{% include "contact-form.njk" %}`,
        },
      },
      {
        h: "Send one and watch it land",
        p: [
          "Run npx @11ty/eleventy --serve, open the page, write yourself something nice. Or test from the terminal. Then read the sandbox back — stored, timestamped, safe.",
        ],
        code: CURL_TEST,
        extra: SANDBOX_STATUS,
      },
      CLAIM_STEP,
      {
        h: "Turn on email",
        p: [
          "Once claimed, connect your inbox and route the Form to it. Saved first, sent second, retried when needed — the boring reliability your minimal site deserves.",
        ],
        code: DELIVERY_CODE,
      },
    ],
    gotchas: [
      {
        h: "Quote the include name",
        p: 'Nunjucks wants {% include "contact-form.njk" %} with quotes. Liquid templates in the same project use their own unquoted syntax — check which engine the including file speaks.',
      },
      ORIGIN_GOTCHA,
      {
        h: "The thanks page",
        p: "A plain form post ends on a small hosted thanks page; a hidden _redirect input pointing at your own page changes that.",
      },
      FIVE_TESTS_GOTCHA,
    ],
    faqs: [
      {
        q: "Does the includes directory have to be _includes?",
        a: "That's Eleventy's default; if your config moves it, the include path follows your configuration, not this guide.",
      },
      {
        q: "Can Markdown pages use the include?",
        a: "Yes — Markdown files preprocessed by Nunjucks or Liquid can pull it in the same way.",
      },
      {
        q: "Is there any JavaScript in this?",
        a: "None. The form posts natively. If you later want an inline confirmation, a small fetch to the same URL does it without touching the include.",
      },
      {
        q: "What happens to messages I don't like?",
        a: "Delete them when you choose. Postbag never quietly bins a message on your behalf — spam included, which is labelled rather than lost.",
      },
    ],
    related: [
      { href: "/features/never-lose-a-submission/", label: "Saved first, sent second" },
      { href: "/features/spam-protection/", label: "Spam protection" },
      { href: "/docs/submit-endpoint/", label: "Submit URL docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "telegram",
    kind: "destination",
    nav: "Telegram",
    title: "Send form submissions to Telegram",
    description:
      "Route form submissions to a Telegram chat, natively — no Zapier in between. Messages are stored first, then delivered to your phone.",
    lede: "Some messages shouldn't wait for you to check email. Your phone buzzes; the record stays safe.",
    needs: [
      "A free Postbag account and an API key",
      "A Form already wired into a site (any guide in the stack list gets you there)",
      "A terminal with curl and jq",
      "A Telegram account and ten spare minutes",
    ],
    outcome:
      "New submissions arriving in a Telegram chat as readable notes, with every one stored durably before it buzzes.",
    agentPrompt: `${SKILL_INSTALL}, then use it to connect my Postbag form to a Telegram chat and prove a test delivery arrived.`,
    steps: [
      {
        h: "Make yourself a bot",
        p: [
          "Telegram's rule is that software speaks through bots, and bots are minted by another bot. Open @BotFather in Telegram, send it /newbot, pick a display name and a username ending in bot. It hands back a token — that string is the bot's identity, so treat it like a password.",
        ],
        code: {
          lang: "text",
          title: "The whole conversation with @BotFather",
          code: `/newbot\nSite messages\nmysitemessages_bot`,
        },
      },
      {
        h: "Find your chat id",
        p: [
          "A bot can't message you until you've messaged it once — Telegram's politeness rule. Open your new bot, send it anything, then ask the API who wrote in. The number at chat.id is your chat id; for a group it's negative, and the bot needs to be a member.",
        ],
        code: {
          lang: "bash",
          title: "One message to the bot, then:",
          code: `curl "https://api.telegram.org/bot<your-bot-token>/getUpdates"`,
        },
      },
      {
        h: "Tell Postbag about it",
        p: [
          "Create a Telegram Destination with the token and chat id. Postbag holds the token, formats each submission into a short readable note — not a wall of JSON on a phone screen — and owns the sending from here on.",
        ],
        code: {
          lang: "bash",
          title: "Create the Destination",
          code: destinationCreateCode(
            `{\n    "type": "telegram",\n    "name": "My phone",\n    "config": { "bot_token": "<your-bot-token>", "chat_id": "<your-chat-id>" }\n  }`,
          ),
        },
      },
      {
        h: "Prove it before it matters",
        p: [
          "Every Destination can be tested before a real message depends on it. This sends a test note through the actual bot to the actual chat — your phone should buzz within a breath or two.",
        ],
        code: DESTINATION_TEST,
      },
      {
        h: "Route your Form to it",
        p: [
          "One Route ties the Form to the chat. From now on each new submission is stored first, then delivered to Telegram — and if Telegram has a moment, the message waits safely while Postbag retries. Prefer calm to buzzing? Switch the Route to a daily digest and get one tidy note instead.",
        ],
        code: { ...DESTINATION_ROUTE, title: "Route Form → Telegram" },
      },
    ],
    gotchas: [
      {
        h: "The first message must be yours",
        p: "Bots can't open a conversation. If getUpdates returns an empty list, you haven't messaged the bot yet — send it a hello and ask again.",
      },
      {
        h: "Group ids go negative",
        p: "A personal chat id is a positive number; a group's is negative, sometimes with a -100 prefix. Copy it exactly as getUpdates shows it, minus signs included.",
      },
      {
        h: "One chat per Destination",
        p: "A Destination points at one chat. Want your phone and a team group both notified? Two Destinations, two Routes — each keeps its own sending record.",
      },
    ],
    faqs: [
      {
        q: "Is this a Zapier trick underneath?",
        a: "No. Telegram is a native Destination — Postbag talks to Telegram's Bot API directly, and each delivery keeps its own retry count and outcome.",
      },
      {
        q: "Can one form notify Telegram and my inbox?",
        a: "Yes. Add an email Destination and a second Route. Each place hears about the same message independently.",
      },
      {
        q: "What does the note look like?",
        a: "The submission's fields as short labelled lines — built to be read on a phone, not decoded.",
      },
      {
        q: "What if Telegram is unreachable?",
        a: "The message is already stored. Postbag retries with growing pauses, and if attempts run out the delivery stays clearly marked for a manual retry.",
      },
    ],
    related: [
      { href: "/features/destinations/", label: "Where messages can go" },
      { href: "/features/routing/", label: "Routing and digests" },
      { href: "/docs/destinations/", label: "Destinations docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "zapier",
    kind: "destination",
    nav: "Zapier",
    title: "Send form submissions to Zapier",
    description:
      "Connect form submissions to Zapier with a Catch Hook webhook: stored first, posted as clean JSON, ready for any Zap you can dream up.",
    lede: "Zapier reaches five thousand apps. Postbag's job is making sure every message survives the trip there.",
    needs: [
      "A free Postbag account and an API key",
      "A Form already wired into a site",
      "A terminal with curl and jq",
      "A Zapier account (webhooks need their paid tier)",
    ],
    outcome:
      "Every new submission flowing into a Zap as tidy JSON — with a stored original to fall back on when an automation misbehaves.",
    agentPrompt: `${SKILL_INSTALL}, then use it to connect my Postbag form to a Zapier webhook and prove a test delivery arrived.`,
    steps: [
      {
        h: "Start a Zap with a Catch Hook",
        p: [
          "In Zapier, create a new Zap and choose Webhooks by Zapier as the trigger, with the Catch Hook event. Zapier hands you a custom URL — that's the letterbox your Zap listens at. Copy it.",
        ],
      },
      {
        h: "Give the hook to Postbag",
        p: [
          "Create a webhook Destination pointing at the Catch Hook URL. Being plain about what this is: Postbag posts JSON, Zapier catches it — a webhook wearing a nice hat, not a special integration. Which is exactly why it will keep working next year.",
        ],
        code: {
          lang: "bash",
          title: "Create the Destination",
          code: destinationCreateCode(
            `{\n    "type": "webhook",\n    "name": "Zapier",\n    "config": { "url": "https://hooks.zapier.com/hooks/catch/…" }\n  }`,
          ),
        },
      },
      {
        h: "Teach the Zap what a message looks like",
        p: [
          "Send a test through the Destination, then click Test trigger in Zapier — it will show the fields it caught. Your visitor's answers ride inside data; the rest is the envelope: which Form, which delivery, when.",
        ],
        code: { ...DESTINATION_TEST, title: "Send a test delivery" },
        extra: WEBHOOK_ENVELOPE,
      },
      {
        h: "Route your Form to it",
        p: [
          "Tie the Form to the Destination and finish building the Zap — a spreadsheet row, a CRM contact, a Slack message, whatever the day calls for. Each new submission is stored first, then posted; if Zapier hiccups, Postbag retries up to ten times and then leaves the delivery clearly marked for you.",
        ],
        code: { ...DESTINATION_ROUTE, title: "Route Form → Zapier" },
      },
    ],
    gotchas: [
      {
        h: "Your fields live under data",
        p: "In the Zap editor, map from the keys inside data — data.email, data.message — not the envelope's own fields. The envelope is bookkeeping; data is the visitor.",
      },
      {
        h: "Zapier doesn't check signatures",
        p: "Catch Hooks accept any post to their URL, so keep that URL private. If you want a shared password, add a custom header in the Destination's config and filter on it in the Zap's first step.",
      },
      {
        h: "The original outlives the Zap",
        p: "When a Zap misfires — wrong mapping, deleted sheet — the submission is still in Postbag, unchanged. Fix the Zap and retry the delivery; nothing needs re-collecting.",
      },
    ],
    faqs: [
      {
        q: "Which Zapier plan do I need?",
        a: "Webhooks by Zapier is a premium trigger, so a paid Zapier plan. Postbag's side works on the free plan.",
      },
      {
        q: "Can I filter what reaches Zapier?",
        a: "Spam and quarantined messages are excluded by default, so the Zap only runs for messages worth automating. Finer rules are easy to add as the Zap's own first step.",
      },
      {
        q: "Does Zapier see file attachments?",
        a: "The webhook carries attachment references with signed links, not raw files — Zapier steps that expect a URL can use them directly.",
      },
      {
        q: "Why not use Zapier's own form tool?",
        a: "If a Zap is your only need, it's fine. Postbag keeps the durable record, the spam handling and the other Destinations — the Zap becomes one reader among several.",
      },
    ],
    related: [
      { href: "/features/destinations/", label: "Where messages can go" },
      { href: "/guides/make/", label: "The Make version" },
      { href: "/docs/destinations/", label: "Destinations docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "make",
    kind: "destination",
    nav: "Make",
    title: "Send form submissions to Make",
    description:
      "Connect form submissions to a Make scenario with a custom webhook: stored first, posted as clean JSON, mapped visually from there.",
    lede: "Make thinks in scenarios. Give it a dependable first module: a form that never loses input.",
    needs: [
      "A free Postbag account and an API key",
      "A Form already wired into a site",
      "A terminal with curl and jq",
      "A Make account (webhooks are on the free tier)",
    ],
    outcome:
      "Submissions arriving as structured bundles in a Make scenario, each one stored durably before the scenario runs.",
    agentPrompt: `${SKILL_INSTALL}, then use it to connect my Postbag form to a Make webhook and prove a test delivery arrived.`,
    steps: [
      {
        h: "Create the webhook in Make",
        p: [
          "Start a new scenario whose first module is Webhooks → Custom webhook. Add a hook, name it after the form, and copy the URL Make generates. Leave the scenario open — in a moment it will want to learn the data's shape.",
        ],
      },
      {
        h: "Give the hook to Postbag",
        p: [
          "Create a webhook Destination pointing at Make's URL. Honest description: Postbag posts JSON to any URL that will have it, and Make's custom webhook is exactly such a URL — no connector app, nothing version-locked.",
        ],
        code: {
          lang: "bash",
          title: "Create the Destination",
          code: destinationCreateCode(
            `{\n    "type": "webhook",\n    "name": "Make",\n    "config": { "url": "https://hook.eu2.make.com/…" }\n  }`,
          ),
        },
      },
      {
        h: "Let Make learn the shape",
        p: [
          "Click Redetermine data structure (or Run once) so the webhook listens, then send a test through the Destination. Make catches it and maps the fields for its visual editor — your visitor's answers are the ones inside data.",
        ],
        code: { ...DESTINATION_TEST, title: "Send a test delivery while Make listens" },
        extra: WEBHOOK_ENVELOPE,
      },
      {
        h: "Route your Form to it",
        p: [
          "Tie the Form to the Destination, then build the rest of the scenario — a sheet, a CRM, an email chain, whatever Make is for in your house. Every new submission is stored before it's posted, and a failed post is retried up to ten times before it's left clearly marked for you.",
        ],
        code: { ...DESTINATION_ROUTE, title: "Route Form → Make" },
      },
    ],
    gotchas: [
      {
        h: "Determine structure with a real test",
        p: "Make maps fields from the first payload it sees. Send the Destination test while the webhook listens, or the visual editor will have nothing to offer when you build the next module.",
      },
      {
        h: "Your fields live under data",
        p: "Map from data.email and data.message, not from the envelope around them. The envelope tells you which Form and which delivery; data is what the visitor wrote.",
      },
      {
        h: "Scheduling is Make's half",
        p: "A scenario set to run every 15 minutes batches whatever arrived in between. The messages wait in Make's queue happily — and the originals are in Postbag either way.",
      },
    ],
    faqs: [
      {
        q: "Free tier friendly?",
        a: "Yes on both sides — Make's custom webhooks and Postbag's free plan cover this whole guide.",
      },
      {
        q: "Can two scenarios hear the same form?",
        a: "Yes. Create two webhook Destinations and two Routes; each delivery is tracked separately.",
      },
      {
        q: "What about spam?",
        a: "Routes exclude spam and quarantined messages by default, so scenarios only run for messages you'd actually want automated.",
      },
      {
        q: "Make or Zapier?",
        a: "Whichever you already think in. Postbag posts the same JSON to both; the guides differ only in where you click.",
      },
    ],
    related: [
      { href: "/features/destinations/", label: "Where messages can go" },
      { href: "/guides/zapier/", label: "The Zapier version" },
      { href: "/docs/destinations/", label: "Destinations docs" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
  {
    slug: "n8n",
    kind: "destination",
    nav: "n8n",
    title: "Send form submissions to n8n",
    description:
      "Connect form submissions to a self-hosted or cloud n8n workflow via webhook — stored first, posted as JSON, verifiable with a signature.",
    lede: "You run your own automations. Run them on a form backend with the same convictions.",
    needs: [
      "A free Postbag account and an API key",
      "A Form already wired into a site",
      "A terminal with curl and jq",
      "An n8n instance — self-hosted or cloud, both work the same here",
    ],
    outcome:
      "Submissions flowing into an n8n workflow you control end to end, each one stored durably before your nodes touch it.",
    agentPrompt: `${SKILL_INSTALL}, then use it to connect my Postbag form to an n8n webhook and prove a test delivery arrived.`,
    steps: [
      {
        h: "Add a Webhook node",
        p: [
          "In a new n8n workflow, add a Webhook node set to POST. It offers two URLs: a test URL that only listens while you're watching, and a production URL that works once the workflow is active. Copy the production one — the test URL's habits are the classic first-day surprise.",
        ],
      },
      {
        h: "Give it to Postbag, with a secret",
        p: [
          "Create a webhook Destination with the production URL and a secret of your choosing. The secret makes each post verifiable: Postbag signs the body, and your workflow can check the signature before trusting a byte of it. Self-hosters tend to appreciate that sentence.",
        ],
        code: {
          lang: "bash",
          title: "Create the Destination",
          code: destinationCreateCode(
            `{\n    "type": "webhook",\n    "name": "n8n",\n    "config": { "url": "https://n8n.your-domain.com/webhook/…", "secret": "a-long-random-string" }\n  }`,
          ),
        },
      },
      {
        h: "Prove it before it matters",
        p: [
          "Activate the workflow, then send a test through the Destination. The execution list shows the delivery: your visitor's answers inside data, the envelope around it saying which Form and when, and a Postbag-Signature header for the sceptical.",
        ],
        code: { ...DESTINATION_TEST, title: "Send a test delivery" },
        extra: WEBHOOK_ENVELOPE,
      },
      {
        h: "Route your Form to it",
        p: [
          "Tie the Form to the Destination and build the rest of the workflow — enrich, file, notify, reply. Every submission is stored before it's posted; if your instance is down for an upgrade, Postbag retries up to ten times and the messages simply wait, unbothered.",
        ],
        code: { ...DESTINATION_ROUTE, title: "Route Form → n8n" },
      },
    ],
    gotchas: [
      {
        h: "Test URL versus production URL",
        p: "The test URL listens only while the editor's Listen button is active; the production URL needs the workflow toggled on. Nine of ten 'it never arrived' reports are this line.",
      },
      {
        h: "Verify the signature if you set a secret",
        p: "The Postbag-Signature header carries a timestamp and an HMAC of the raw body. The destinations feature page has a ready verification snippet you can drop into a Code node.",
      },
      {
        h: "Respond quickly, work slowly",
        p: "Set the Webhook node to respond immediately and do heavy work in later nodes. Postbag treats a slow response as a failed attempt and retries — well-meant, but noisy if your workflow likes to think first.",
      },
    ],
    faqs: [
      {
        q: "Does self-hosted n8n behind my firewall work?",
        a: "The webhook URL must be reachable from Postbag Cloud — or run Postbag yourself on the same network and keep the whole path in the house.",
      },
      {
        q: "Why the secret?",
        a: "Anyone who learns the URL could post fake submissions. The signature proves each delivery came from Postbag and wasn't altered en route.",
      },
      {
        q: "Can n8n fetch the stored original later?",
        a: "Yes — the envelope carries ids, and the full API can read any submission by id with your key.",
      },
      {
        q: "What happens during an n8n upgrade?",
        a: "Deliveries fail, retry with growing pauses, and succeed when the instance returns. Attempts that run out stay clearly marked for a one-click retry.",
      },
    ],
    related: [
      { href: "/features/destinations/", label: "Where messages can go (and the verify snippet)" },
      { href: "/docs/self-hosting/", label: "Self-host Postbag" },
      { href: "/guides/make/", label: "The Make version" },
    ],
    published: "2026-09-09",
    modified: "2026-09-14",
  },
]

export const FRAMEWORK_GUIDES = () => GUIDES.filter((g) => g.kind === "framework")
export const DESTINATION_GUIDES = () => GUIDES.filter((g) => g.kind === "destination")
