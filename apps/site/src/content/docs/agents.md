---
title: "Agent guide: set up Postbag from a coding agent"
description: "Step-by-step guide for AI coding agents (Claude Code, Cursor, Codex, Copilot) to create, verify and route a Postbag form with only an API key: discovery, quickstart, test submissions, destinations, streams, idempotency, and the postbag.json repo convention."
order: 20
section: Guides
---

This page is written to be followed by an agent. It is also what `GET /llms.txt` points to. If you are an agent reading this: you need an API key with the `manage` scope and nothing else.

## 0. Orientation

```
GET {API}/llms.txt                # Markdown onboarding: vocabulary, the three calls, conventions
GET {API}/openapi.json            # full contract, generated from live routes
GET {API}/v1/me                   # organization, scopes, limits, counts of what exists
```

Vocabulary is fixed: organization, project, form, submission, form_schema, stream, stream_schema, mapping, destination, route, delivery, drift. Do not invent synonyms when you write code or config for the user.

## 1. Create a working form in one call

```
POST {API}/v1/quickstart
{ "name": "<human name>", "project": "<slug, default 'default'>",
  "origin": "https://<the site>", "notify_email": "<user's email>",
  "telegram": { "bot_token": "…", "chat_id": "…" } /* optional */,
  "webhook": { "url": "…", "secret": "…" } /* optional */ }
```

Idempotent by (project, name): re-running returns the same form. The response has `form.submit_url`, `embed` (html, fetch, react, astro, nextjs_action), `verify` (a curl and a follow-up GET), and `next[]`.

## 2. Put the form in the site

Use `embed.<framework>` verbatim or adapt it. Keep the honeypot input (`_gotcha`) and, for non-JS forms, a `_redirect`. Never hand-write a submit URL: take it from the API response.

## 3. Verify without a human

```
POST {submit_url}  { "email": "agent@example.com", "message": "test", "_test": true }
→ { "ok": true, "submission_id": "sb_…", "status": "received", "deliveries": ["dl_…"] }
GET {API}/v1/deliveries/dl_…   → poll until status is "sent" (or "failed"/"dead": read last_error and response)
```

For a destination on its own: `POST {API}/v1/destinations/{id}/test` returns the provider's response inline.

## 4. Record the wiring in the repo

Write `postbag.json` at the repo root:

```json
{ "form_id": "fm_…", "submit_url": "https://…/s/fm_…", "project": "portfolio" }
```

and add to `CLAUDE.md` / `AGENTS.md`:

> Forms on this site post to Postbag. Config in `postbag.json`. To add a form, create it through the Postbag API in the same project and use the embed from the response. Never hand-write a submit URL.

## 5. Fleet mode (many sites, one partner)

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
