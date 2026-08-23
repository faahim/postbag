---
title: "Postbag documentation"
description: "Give a Form somewhere dependable to go. Start before signup, use the complete API, or run the same open-source product yourself."
order: 0
section: Start
modified: "2026-08-24"
---

Postbag is the open-source form backend built for agents. A website posts to a stable Form URL. Postbag saves every Submission first, then Routes it to email, Telegram, a signed webhook, or another Destination.

An agent can create and test a bounded sandbox Form before you sign up. When the work is ready to keep, claim the same Form, add a Destination and Route, and send a new Submission to verify Delivery.

## Choose your starting point

### Let your agent handle it

Install the Postbag skill, then give the agent the job:

```bash
npx skills add faahim/postbag --skill postbag
```

The agent can create a sandbox, wire the returned submit URL into the site, send a test, and prove Postbag stored it. The sandbox lasts 24 hours and accepts up to five test Submissions. No account or API key is needed for that first proof.

[Follow the agent guide](/docs/agents/)

### Start from an account

If you already have a manage-scoped API key, `POST /v1/quickstart` creates a Form and returns its submit URL, embed snippets, verification call, and next steps. Include at least one email, Telegram, or webhook Destination if you want the quickstart to create a Route and produce Deliveries.

[Open the quickstart](/docs/quickstart/)

### Run Postbag yourself

Postbag is one application image plus Postgres 16. OAuth providers are optional. Email-code authentication and email Delivery need a configured mail provider, while the rest of the product remains available without social login.

[Read the self-hosting guide](/docs/self-hosting/)

## The one idea

**The database makes it correct; events make it fast.** A Submission is a row before it is anything else. Delivery runs through a durable outbox. Spam, quota, and rate-limit outcomes are stored with a status instead of disappearing.

A Form can receive without a Route. It cannot deliver until a Destination and Route connect it to somewhere onward. That distinction is deliberate: receiving and keeping data must not depend on a provider being available.

## Find the exact answer

- [Submit endpoint](/docs/submit-endpoint/) covers content types, control fields, browser origins, and response shapes.
- [API overview](/docs/api/) covers authentication, resources, pagination, idempotency, and errors.
- [Routing](/docs/routing/) explains how Forms and Streams connect to Destinations.
- [Schemas](/docs/schemas/) explains immutable versions, observe mode, and Drift.
- [Webhook signatures](/docs/webhooks/) includes verification examples for Node, Python, and Go.
- [Architecture](/docs/architecture/) and [Security](/docs/security/) explain the outbox, tenancy, and trust boundaries.
- [Error codes](/docs/errors/) maps every API error to a concrete recovery step.

## Documentation for agents

The running server describes itself. `GET /llms.txt` is the short onboarding document and `GET /openapi.json` is generated from the live route definitions.

Every documentation page also has a Markdown twin. Send `Accept: text/markdown` or append `index.md` to its path. [/llms-full.txt](/llms-full.txt) concatenates the complete documentation set for a larger context window.
