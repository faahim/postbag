/**
 * Content for `/legal/*`. Copy is Markdown built from `LEGAL`/`SUBPROCESSORS` (`@/config`) so
 * the operator name, address, contact and dates never appear as separate literals — change
 * `config.ts` and all four pages change with it. Rendered by `@/lib/markdown.ts`.
 */
import { LEGAL, PLANS, SITE_URL, SUBPROCESSORS } from "@/config"

export interface LegalDoc {
  slug: "terms" | "privacy" | "dpa" | "subprocessors"
  title: string
  description: string
  markdown: string
}

const free = PLANS.find((p) => p.id === "free")
const pro = PLANS.find((p) => p.id === "pro")
const team = PLANS.find((p) => p.id === "team")
if (!free || !pro || !team) throw new Error("legal.ts: expected free, pro and team plans in PLANS")

const subprocessorTable = [
  "| Sub-processor | Purpose | Data | Location |",
  "| --- | --- | --- | --- |",
  ...SUBPROCESSORS.map((s) => `| ${s.name} | ${s.purpose} | ${s.data} | ${s.location} |`),
].join("\n")

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    description: `The terms for using Postbag, the hosted service at ${SITE_URL.replace(/^https?:\/\//u, "")}, operated by ${LEGAL.operator}.`,
    markdown: `
## Who we are

${LEGAL.operator}, trading as ${LEGAL.tradingAs}, operates Postbag from ${LEGAL.address}. Contact us at [${LEGAL.email}](mailto:${LEGAL.email}).

## The service

Postbag is a form backend: point an HTML form at a Postbag endpoint and we store every submission, then deliver it to email, Telegram or a webhook by rules you configure. The Free plan's limits are on the [pricing page](/pricing/). Paid plans, when available, are sold through a Merchant of Record, Polar, whose own terms govern the payment itself — we never see or store your card details.

## Your account

Give us accurate account information and keep your API keys secret; a key authenticates as you. Accounts are for one person — add teammates as members of your organization rather than sharing a login. You are responsible for the forms you create and the data they're configured to collect.

## Acceptable use

Don't use Postbag to send spam or phishing, to collect data you have no right to collect, to host unlawful content, or to abuse the submit endpoint. We may suspend a form or an account for abuse. Suspension only stops new delivery — submissions already stored are never deleted for this; they're only deleted by your own action or by the retention policy below.

## Your data

You own the submissions your forms receive. We process them only to provide the service — storing, routing and delivering them as you've configured. See the [Privacy Policy](/legal/privacy/) and, for organizations that need it, the [Data Processing Addendum](/legal/dpa/).

## Availability

Postbag is provided "as is", on a best-effort basis, with no service-level agreement on the Free plan. We keep daily backups.

## Open source

The Postbag server is licensed AGPL-3.0; the SDK, CLI and MCP server are MIT. Self-hosting is yours to run, on your own infrastructure and your own responsibility — these Terms cover the hosted service, not a self-hosted instance.

## Termination

You can close your account at any time by emailing us; export anything you need first (the API returns your submissions in full, at any time, while your account is open). We may suspend or terminate an account for a clear breach of "Acceptable use" above, with notice where practical.

## Liability

To the extent the law allows, our liability to you under these Terms is capped at the greater of the fees you paid us in the preceding 12 months, or USD 50.

## Changes to these terms

We update the date at the top of this page whenever these Terms change. Material changes are emailed to account holders at least 14 days before they take effect.

## Governing law

These Terms are governed by the law of ${LEGAL.governingLaw}, and any dispute is subject to the courts of that jurisdiction.

## Contact

[${LEGAL.email}](mailto:${LEGAL.email})
`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    description: `How Postbag handles personal data for account holders and for the people who submit forms built by our customers. Operated by ${LEGAL.operator}.`,
    markdown: `
Postbag processes two different kinds of personal data, for two different people: **account holders**, who sign up to use Postbag, and **form submitters**, visitors who fill in a form built by one of our customers. This policy covers both, separately.

## Account holders

### What we collect

Your name and email address; a password hash, or an identity from Google or GitHub if you sign in that way; your API keys (stored as hashes, never in plaintext); usage logs; and the IP address and country of your requests, resolved via Cloudflare.

### Why we process it

To provide the service — create your account, run your forms, deliver your submissions — to keep it secure (rate limiting, abuse prevention), and to send transactional email such as delivery notifications and security alerts.

### Legal bases

Performance of a contract (running your account) and our legitimate interest in keeping the service secure and reliable.

### Retention

For as long as your account is active, plus 30 days after closure, to allow recovery from an accidental deletion.

### Your rights

Access, rectification, erasure, portability and objection. Email [${LEGAL.email}](mailto:${LEGAL.email}) and we'll act on it.

### Cookies

The dashboard sets one session cookie so you stay signed in. This marketing site sets no cookies at all — no analytics, no trackers; the only client-side storage it uses is your light/dark theme preference.

### Who sees it

Account data is visible to ${LEGAL.operator} as operator, and to the sub-processors listed on our [sub-processors page](/legal/subprocessors/) — hosting, email delivery and, on paid plans, payment processing.

### International transfers

${LEGAL.operator} operates Postbag from ${LEGAL.address}. Data is currently hosted in ${LEGAL.dataLocation}. All data in transit is encrypted with TLS, and access to production systems is limited to the operator.

### Children

Postbag is not directed at, and we do not knowingly collect data from, anyone under 16.

### EU representative

We have not appointed an EU representative under Article 27 of the GDPR. Postbag is operated by one person processing personal data at a small scale, which we believe falls within the Article 27(2) exemption; we'll revisit this if that changes. If you have concerns, contact us directly.

## Form submitters

If you filled in a form built by one of our customers, Postbag is the **processor**; the site that showed you the form is the **controller**, and is generally who you should contact first.

### What arrives

Whatever fields the form submits, plus the IP address, user agent, country and timestamp of the submission.

### Where it goes

Wherever the site owner configured — typically their email, and possibly other systems they've connected.

### Retention

${free.retention} days on the site owner's Free plan; longer on paid plans (up to ${team.retention} days). The site owner can delete a submission at any time.

### We never sell it

We do not sell submission data, and we do not use it for anything except delivering it the way the site owner configured.

### Exercising your rights

Contact the website that showed you the form first — they are the controller. If you contact us instead, at [${LEGAL.email}](mailto:${LEGAL.email}), we'll forward your request to them.

## Contact

[${LEGAL.email}](mailto:${LEGAL.email}) · ${LEGAL.address}
`,
  },
  {
    slug: "dpa",
    title: "Data Processing Addendum",
    description: `GDPR Article 28 processing terms for organizations using Postbag to process their form submitters' personal data.`,
    markdown: `
This Data Processing Addendum ("DPA") forms part of the agreement between ${LEGAL.operator}, trading as ${LEGAL.tradingAs} ("we", the Processor) and the organization using Postbag (the Controller) for the personal data of that organization's form submitters. It's accepted by using the service once your account processes such data — no signature is required, but a signed copy is available on request; email [${LEGAL.email}](mailto:${LEGAL.email}).

## Subject matter and duration

We process personal data on your behalf for as long as your Postbag account is active, and for the retention period after that described in our [Privacy Policy](/legal/privacy/).

## Nature and purpose of processing

Receiving, storing and delivering the submissions your forms collect, according to the routes and destinations you configure.

## Categories of data subjects

Visitors to your website(s) who submit a form connected to Postbag.

## Categories of data

Whatever fields your form collects, plus IP address, user agent, country and timestamp. We don't expect or require special categories of data (health, biometric and similar); please don't route them through Postbag.

## Our instructions

We process data only as instructed by you, through the forms, streams, destinations and routes you configure — never for our own purposes.

## Confidentiality

Access to production data is limited to the operator, ${LEGAL.operator}, who is bound by confidentiality as a condition of operating the service.

## Security measures

TLS in transit; HMAC-SHA256-signed webhook deliveries; API keys stored as hashes, never in plaintext; every tenant row scoped by organization at the application level, with a database-level second fence (Postgres row-level security) being rolled out; daily backups retained for 14 days.

## Sub-processors

Listed with purpose, data and location on our [sub-processors page](/legal/subprocessors/). We give at least 14 days' notice before adding a new sub-processor, so you can object.

## Assistance

We help you respond to data subject requests and to any regulator inquiry, to the extent Postbag's design allows.

## Deletion and return

Submission data is deleted per your plan's retention period or on your request; you can delete a submission or a form's data at any time, and export it via the API before you do. On account closure, remaining data is retained for 30 days and then deleted.

## Audit

We provide this DPA and our [security documentation](/docs/security/) in place of on-site audits; if you need more, contact us.

## International transfers

Data is currently hosted in ${LEGAL.dataLocation}. Where personal data leaves the EEA, we rely on TLS in transit and limit access to the operator; EU hosting is planned.

## Contact

[${LEGAL.email}](mailto:${LEGAL.email})
`,
  },
  {
    slug: "subprocessors",
    title: "Sub-processors",
    description: "Every third party that touches account or submission data on Postbag's behalf: what they do, what they see, and where.",
    markdown: `
Every third party that touches account or submission data on Postbag's behalf, what it does, what it sees, and where. We give at least 14 days' notice on this page before adding a new sub-processor or changing what an existing one does.

${subprocessorTable}

This list is also referenced from the [Data Processing Addendum](/legal/dpa/) and the [Privacy Policy](/legal/privacy/). Questions: [${LEGAL.email}](mailto:${LEGAL.email}).
`,
  },
]

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug)
}
