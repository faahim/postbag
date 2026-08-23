---
title: "Agent guide: start a Postbag Form before signup"
description: "Create and verify a bounded sandbox Form without credentials, claim it after email-code or browser authentication, then add Destinations and Routes without changing its submit URL."
order: 20
section: Guides
---

This page is written to be followed by an agent. It is also what `GET /llms.txt` points to. If you have no credentials, start with a sandbox Form. If you already have a manage-scoped API key, use the authenticated quickstart instead.

## 0. Orientation

```
GET {API}/llms.txt                # Markdown onboarding: vocabulary, the three calls, conventions
GET {API}/openapi.json            # full contract, generated from live routes
GET {API}/v1/me                   # after auth: organization, scopes, limits, counts
```

Vocabulary is fixed: organization, project, form, submission, form_schema, stream, stream_schema, mapping, destination, route, delivery, drift. Do not invent synonyms when you write code or config for the user.

## 1. Create a sandbox Form without credentials

Generate a lowercase UUIDv4 with a cryptographically secure random generator and keep both it and the returned token secret:

```bash
curl -X POST {API}/v1/public/sandboxes \
  -H "content-type: application/json" \
  -H "Idempotency-Key: <uuidv4>" \
  -d '{ "name": "Contact", "origin": "https://example.com" }'
```

The response contains the stable `sandbox.submit_url`, embed snippets, a one-time `sandbox_token`, a browser `claim_url`, verification calls and `next[]`. The sandbox lasts 24 hours, accepts at most five 16 KiB test Submissions and cannot create Destinations, Routes, Deliveries, Events or outbound traffic.

Use `claim_email` only when the user explicitly supplied the email they will use for Postbag. Never infer it from Git metadata or another account.

## 2. Put it in the site and prove receipt

Use the returned embed. Keep the honeypot input (`_gotcha`) and never hand-write the submit URL. Submit a test, then read it back with the sandbox capability:

```bash
POST {submit_url}  { "email": "agent@example.com", "message": "test" }
GET {API}/v1/public/sandboxes/{id}
Authorization: Sandbox <sandbox_token>
```

Anonymous receipt is durable but inert: there are no delivery ids to poll before claim.

## 3. Authenticate and claim the same Form

Run `postbag login` to obtain and save a manage key by email code, or let the user open the returned `/app/claim#token=…` URL and sign in with Google or GitHub. For the agent-led path:

```bash
postbag login
postbag sandbox claim --token pbs_…
```

The HTTP equivalent is `POST /v1/auth/request-code`, `POST /v1/auth/verify-code`, then `POST /v1/sandboxes/{id}/claim` with both Bearer authentication and `Postbag-Sandbox-Token`. API key names are 1–32 characters. Claiming keeps the Form id and submit URL and copies the anonymous rows as tests; those tests never deliver retroactively.

## 4. Add a Destination and Route, then verify delivery

Create a Destination and a Route for the claimed Form, then send a new Submission. Only new post-claim Submissions can create Deliveries. Poll the returned Delivery id until `sent`, `failed` or `dead`.

## Authenticated alternative: one call to a routed Form

```
POST {API}/v1/quickstart
{ "name": "<human name>", "project": "<slug, default 'default'>",
  "origin": "https://<the site>", "notify_email": "<user's email>",
  "telegram": { "bot_token": "…", "chat_id": "…" } /* optional */,
  "webhook": { "url": "…", "secret": "…" } /* optional */ }
```

Idempotent by (project, name): re-running returns the same form. The response has `form.submit_url`, `embed` (html, fetch, react, astro, nextjs_action), `verify` (a curl and a follow-up GET), and `next[]`.

### Verify the authenticated path

```
POST {submit_url}  { "email": "agent@example.com", "message": "test", "_test": true }
→ { "ok": true, "submission_id": "sb_…", "status": "received", "deliveries": ["dl_…"] }
GET {API}/v1/deliveries/dl_…   → poll until status is "sent" (or "failed"/"dead": read last_error and response)
```

For a destination on its own: `POST {API}/v1/destinations/{id}/test` returns the provider's response inline.

## 5. Record the wiring in the repo

Write `postbag.json` at the repo root:

```json
{ "form_id": "fm_…", "submit_url": "https://…/s/fm_…", "project": "portfolio" }
```

and add to `CLAUDE.md` / `AGENTS.md`:

> Forms on this site post to Postbag. Config in `postbag.json`. To add a form, create it through the Postbag API in the same project and use the embed from the response. Never hand-write a submit URL.

## 6. Fleet mode (many sites, one partner)

When a stream already exists for the kind of site you are building:

```
GET  {API}/v1/streams/{id}            # current schema, sources, and a form template
POST {API}/v1/forms { "from_template": "st_…", "name": "<site> contact", "tags": ["vending"], "schema_mode": "managed" }
```

The form comes back pre-attached to the stream with a valid mapping and its schema served at `GET /s/{id}/schema`. If the mapping would be incomplete, you get a `422 mapping_incomplete` listing the missing fields, now, not at delivery time.

## Rules of the road

- Send `Idempotency-Key` on POSTs you might retry. Use `if_exists: "return"` on creates.
- Every error is `{ code, message, hint, docs }`. Read `hint` first; it is written for you.
- Ids tell you what they are: `fm_`, `sb_`, `st_`, `ds_`, `rt_`, `dl_`, `prj_`.
- Spam and quarantine are statuses, not rejections. A 200 with `"status": "quarantined"` means stored, not delivered; read `quarantine_reason`.
- Include the configured site's `Origin` header in test submissions. Paths and trailing slashes are normalized, but a curl without `Origin` does not exercise browser-origin checks.
- After fixing a quarantine cause, `PATCH /v1/submissions/{id}` to `{"status":"received"}` to release the stored submission and queue its deliveries.
- Do not poll submissions to "see if it worked"; poll the delivery ids from a `_test` post.
