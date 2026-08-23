---
title: "Agent guide: start a Postbag Form before signup"
description: "Create, wire, and verify a sandbox Form without credentials, then claim it and configure Delivery without changing its submit URL."
order: 20
section: Guides
modified: "2026-08-24"
---

This page is written as an execution guide for coding agents. The dashboard is available when a person wants it, but the complete workflow also works through the API, CLI, MCP server, and Postbag skill.

Install the skill when your environment supports agent skills:

```bash
npx skills add faahim/postbag --skill postbag
```

The CLI, SDK, and MCP server are published as `postbag`, `@postbag/sdk`, and `@postbag/mcp` on npm.

## Orient before changing anything

```text
GET {API}/llms.txt       # short Markdown onboarding
GET {API}/openapi.json   # complete contract generated from live routes
GET {API}/v1/me          # organization, scopes, limits, and counts after auth
```

Use the fixed vocabulary in user-facing text and implementation: Organization, Project, Form, Submission, Stream, Schema, Mapping, Destination, Route, Delivery, and Drift. Do not invent substitutes.

If `postbag.json` already exists, reuse its `form_id` and `submit_url`. Do not create a second Form for the same job.

## Create a sandbox without credentials

Use a canonical UUIDv4 as the idempotency key. Generate it with a cryptographically secure random generator.

```bash
curl -X POST {API}/v1/public/sandboxes \
  -H "content-type: application/json" \
  -H "Idempotency-Key: <uuidv4>" \
  -d '{ "name": "Contact", "origin": "https://example.com" }'
```

The response contains `sandbox.submit_url`, embed snippets, `sandbox_token`, `claim_url`, verification calls, and `next[]`.

The capability is shown only in this creation response. Keep it secret. It can be reused to read and claim this sandbox until the sandbox is claimed or expires. The sandbox lasts 24 hours, accepts at most five 16 KiB test Submissions, and cannot create Destinations, Routes, Deliveries, Events, or outbound traffic.

Set `claim_email` only when the user explicitly supplied the email they will use for Postbag. Never infer it from Git metadata or another account.

## Wire and prove receipt

Use the embed returned by Postbag. Keep the honeypot input and the exact submit URL.

```text
POST {submit_url}
Origin: https://example.com
{ "email": "agent@example.com", "message": "test" }

GET {API}/v1/public/sandboxes/{id}
Authorization: Sandbox <sandbox_token>
```

The read response is the proof: Postbag committed the Submission. Do not look for a Delivery before claim because anonymous receipt is deliberately inert.

## Authenticate and claim

The email-code flow works without a browser:

```bash
postbag login --email owner@example.com
postbag login --email owner@example.com --code 123456
postbag sandbox claim --token "pbs_…"
```

The HTTP flow is `POST /v1/auth/request-code`, `POST /v1/auth/verify-code`, then `POST /v1/sandboxes/{id}/claim` with Bearer authentication and the `Postbag-Sandbox-Token` header. API key names are 1-32 characters.

Google and GitHub OAuth are optional. They are browser alternatives only when the instance operator configured both credentials for a provider. The email-code and API-key path remains the portable agent path.

Claiming preserves the Form id and submit URL. It copies anonymous rows as test Submissions, but those tests never deliver retroactively.

## Configure and verify Delivery

Delivery requires two resources after claim:

1. A Destination that defines where the Submission should go.
2. A Route that connects the Form or Stream to that Destination.

Create both, then send a new `_test` Submission. Poll the returned Delivery id until its status is `sent`, `failed`, or `dead`. If it fails, read `last_error` and the recorded provider response before changing the configuration.

`POST /v1/destinations/{id}/test` tests a Destination in isolation. It does not prove that the Form has a Route, so finish with a real Form Submission.

## Use the authenticated shortcut

With a manage-scoped key, `POST /v1/quickstart` can create the Project, Form, Destination, and Route together:

```json
{
  "name": "Contact",
  "project": "website",
  "origin": "https://example.com",
  "notify_email": "owner@example.com"
}
```

Pass at least one of `notify_email`, `telegram`, or `webhook` when Delivery is required. Without one, the call still creates a receiving Form, but it has no Destination or Route.

The response includes `form.submit_url`, framework-specific `embed` snippets, a browser-equivalent `verify` call, and `next[]`. The operation is idempotent by Project and Form name.

## Leave a durable handoff

Write `postbag.json` at the repository root:

```json
{
  "form_id": "fm_…",
  "submit_url": "https://postbag.dev/s/fm_…",
  "project": "website"
}
```

Add this instruction to the repository agent file:

> Forms on this site post to Postbag. The wiring is in `postbag.json`. Reuse it. Create additional Forms through the Postbag API and use the returned embed instead of writing submit URLs by hand.

Never store an API key or sandbox capability in the repository.

## Rules of the road

- Send `Idempotency-Key` on POST requests you may retry. Use `if_exists: "return"` on supported creates.
- Every error is `{ code, message, hint, docs }`. Read `hint` before improvising a recovery.
- Id prefixes are part of the contract: `fm_`, `sb_`, `st_`, `ds_`, `rt_`, `dl_`, and `prj_`.
- Spam and quarantine are stored statuses. A `200` with `"status": "quarantined"` means Postbag kept the Submission but did not queue Delivery.
- Include the configured site `Origin` header in verification requests. A curl request without it does not test browser-origin policy.
- After fixing a quarantine cause, release the stored Submission with `PATCH /v1/submissions/{id}` and `{ "status": "received" }`.
- Poll the Delivery ids returned by a `_test` Submission. Do not poll a Submission and infer that Delivery worked.
