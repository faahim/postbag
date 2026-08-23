---
title: "Postbag documentation"
description: "Start here: what Postbag is, the three calls that matter, and where everything else lives. Written for humans and for agents; every page has a Markdown twin."
order: 0
section: Start
---

Postbag is a form backend that routes. Websites `POST` to a submit URL; Postbag stores every submission durably and delivers it to email, Telegram and signed webhooks according to routes you configure. It is multi-tenant, self-hostable, and agent-native: an agent can create and test a bounded sandbox Form without credentials, then claim and route that same Form after a human authenticates.

## The one idea

**The database makes it correct; events make it fast.** A submission is a row before it is anything else. Delivery is an outbox drained by a worker. Spam, quota and rate-limit outcomes are stored with a status, never dropped.

## The two starting paths

**No credentials yet:** `POST /v1/public/sandboxes` creates a bounded 24-hour Form and returns its stable submit URL plus a one-time sandbox capability. Submit to `/s/{formId}`, verify the stored tests with `GET /v1/public/sandboxes/{id}`, then authenticate and call `POST /v1/sandboxes/{id}/claim`. The Form id and submit URL do not change.

**Already authenticated:** call `GET /v1/me` first, then `POST /v1/quickstart` for a working routed Form. It is idempotent by project and name and returns the submit URL, embed snippets and a verification recipe.

Both paths converge on the same tenant Form. Only new Submissions after claim and Route setup can deliver; anonymous and copied test Submissions never deliver retroactively.

## Where to go next

- [Quickstart](/docs/quickstart/): three minutes to your first email.
- [Submit endpoint](/docs/submit-endpoint/): every control field, content type and status.
- [API overview](/docs/api/): resources, conventions, pagination, idempotency, errors.
- [Agent guide](/docs/agents/): the exact flow an agent should follow, and the repo conventions.
- [Webhook signatures](/docs/webhooks/): verify `Postbag-Signature` in Node, Python and Go.
- [Routing](/docs/routing/), [Schemas](/docs/schemas/), [Destinations](/docs/destinations/).
- [Architecture](/docs/architecture/), [Security](/docs/security/), [Self-hosting](/docs/self-hosting/), [Error codes](/docs/errors/).

## For agents

The live API describes itself: `GET /llms.txt` is the onboarding page in Markdown and `GET /openapi.json` is generated from the route definitions, so it is always current. Every page on this site also has a Markdown twin: request it with `Accept: text/markdown`, or append `index.md` to the URL path. The whole documentation set is concatenated at [/llms-full.txt](/llms-full.txt).
