---
title: "Postbag documentation"
description: "Start here: what Postbag is, the three calls that matter, and where everything else lives. Written for humans and for agents; every page has a Markdown twin."
order: 0
section: Start
---

Postbag is a form backend that routes. Websites `POST` to a submit URL; Postbag stores every submission durably and delivers it to email, Telegram and signed webhooks according to routes you configure. It is multi-tenant, self-hostable, and agent-native: everything a human can do in the dashboard, an agent can do with an API key.

## The one idea

**The database makes it correct; events make it fast.** A submission is a row before it is anything else. Delivery is an outbox drained by a worker. Spam, quota and rate-limit outcomes are stored with a status, never dropped.

## The three calls that matter

1. `GET /v1/me`: who am I, which organization, which scopes, what already exists. Call this first with your API key.
2. `POST /v1/quickstart`: one call to a working, routed form. Idempotent by (project, name). Returns a submit URL, embed snippets and a verification recipe.
3. `POST /s/{formId}`: submit to a form. No auth. Accepts JSON, urlencoded and multipart (text fields). Pass `_test: true` to get submission and delivery ids back, so you can poll `GET /v1/deliveries/{id}` and see `sent`.

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
