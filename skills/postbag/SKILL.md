---
name: postbag
description: Use when a site or app needs a form endpoint, contact form, lead capture, or to route submissions to email/Telegram/webhooks.
---

# Postbag

Postbag is a form backend that routes. Point any HTML form (or a `fetch` call) at a
Postbag endpoint and every submission is stored durably, then delivered to email,
Telegram, webhooks and other systems according to rules. It is agent-native:
everything a human can do in the dashboard, you can do with an API key — no browser,
no human in the loop except to read a 6-digit code out of their inbox once.

Root of the API: `https://postbag.dev`. Full contract: `https://postbag.dev/openapi.json`. Agent
onboarding page (short, always current): `https://postbag.dev/llms.txt`. Human docs:
`https://postbag.dev/docs/`.

## Decision tree

1. **Does `postbag.json` already exist in this repo?** Reuse its `form_id` and
   `submit_url` — never hand-write a submit URL, and never create a second form for
   the same purpose. `npx postbag whoami` confirms the saved key still works.
2. **Is `POSTBAG_API_KEY` set, or does `~/.config/postbag/credentials.json` exist?**
   Use that key. `npx postbag whoami` / `GET https://postbag.dev/v1/me` confirms it.
3. **Otherwise, get a key without a browser.** Ask the human for their email, then
   run the code flow below. This is the only step that needs a human, and it takes
   one message from them (the 6-digit code).

## Getting a key (no browser)

```
npx postbag login --email you@example.com
# → "Code sent to you@example.com — check your inbox"
npx postbag login --email you@example.com --code 123456
# → saves the key to ~/.config/postbag/credentials.json, prints the org name
```

Raw HTTP equivalent:

```
curl -X POST https://postbag.dev/v1/auth/request-code -d '{"email":"you@example.com"}'
# → { "ok": true, "expires_in": 600, "next": "POST /v1/auth/verify-code with { email, code, key_name }" }

curl -X POST https://postbag.dev/v1/auth/verify-code -d '{"email":"you@example.com","code":"123456"}'
# → { "api_key": "pb_live_…", "organization": { "id": "org_…", "slug": "…", "name": "…" }, "next": [...] }
```

A new email provisions an organization first; an existing email reuses its own. The
key is shown once — store it as `POSTBAG_API_KEY` or let `postbag login` save it.

## One call to a working form

```
npx postbag init --yes --email you@example.com
```

Raw HTTP equivalent:

```
curl -X POST https://postbag.dev/v1/quickstart -H "Authorization: Bearer pb_live_…" -d '{
  "name": "Portfolio contact", "notify_email": "you@example.com",
  "origin": "https://example.com", "project": "portfolio"
}'
```

Response (creates the project/form/destination/route idempotently by name):

```json
{
  "form": { "id": "fm_8f3kq2", "submit_url": "https://postbag.dev/s/fm_8f3kq2" },
  "embed": { "html": "…", "fetch": "…", "react": "…", "astro": "…", "nextjs_action": "…" },
  "verify": { "curl": "curl -X POST … -d '{\"_test\":true,…}'", "then": "GET /v1/forms/fm_8f3kq2/submissions?limit=1" },
  "next": [ { "why": "Add Telegram", "call": "POST /v1/destinations", "body": { "…": "…" } } ]
}
```

`postbag init` also writes `postbag.json` (`form_id`, `submit_url`, `project`) into
the repo — leave it there for the next session.

## Embed snippet (HTML)

```html
<form action="https://postbag.dev/s/fm_8f3kq2" method="POST">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>
```

`embed.fetch` / `embed.react` / `embed.astro` / `embed.nextjs_action` in the
quickstart response give the same thing for JS-rendered forms.

## Verify a test submission

```
npx postbag submissions tail --form fm_8f3kq2
```

Raw HTTP equivalent:

```
curl -X POST https://postbag.dev/s/fm_8f3kq2 -d '{"email":"a@b.com","message":"hi","_test":true}'
# → { "ok": true, "submission_id": "sb_…", "status": "received", "deliveries": ["dl_…"] }

curl https://postbag.dev/v1/deliveries/dl_… -H "Authorization: Bearer pb_live_…"
# → { "status": "sent", "attempts": 1 }
```

`_test: true` submissions are excluded from quotas and auto-purged after 24h — this
is the standard way to confirm a form actually delivers before telling the human it's
done.

## Vocabulary

`form` — the endpoint a site posts to. `submission` — one received payload.
`stream` — a named group of forms with a shared output shape (a "Bag" in the
dashboard; attach the first form and its fields become the stream's version-1 schema,
no hand-written schema needed). `destination` —
somewhere submissions go (email/telegram/webhook). `route` — form/stream →
destination with rules. `delivery` — one attempt-tracked send. Never use "endpoint",
"integration", "channel", "hook" or "entry" as synonyms for these.

## More

- `npx postbag --help` — every command has a one-line description.
- `https://postbag.dev/llms.txt` — the short agent onboarding page (start here for anything
  not covered here).
- `https://postbag.dev/openapi.json` — the full contract; every call above is also a plain
  `Authorization: Bearer pb_live_…` HTTP request if `npx postbag`/`npx @postbag/mcp`
  aren't available in your environment.
- `https://postbag.dev/docs/` — human-readable docs, including `/docs/errors/{code}/` for
  every error code (every error is `{ code, message, hint, docs }`).
