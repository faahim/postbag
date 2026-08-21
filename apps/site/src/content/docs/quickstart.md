---
title: "Quickstart: your first form in three minutes"
description: "Create a Postbag account, get a submit URL, point an HTML form at it, and receive the first submission by email. Works with plain HTML, fetch, React, Astro and Next.js."
order: 1
section: Start
---

The solo-dev test Postbag is held to: time from signup to the first email in your inbox under three minutes, meeting exactly one new noun (Form).

## 1. Create an account and a form

Sign up at [/app](/app/sign-up). The first-run screen creates a form and asks for the email that should be notified. You get a submit URL like `https://postbag.withfaahim.com/s/fm_8f3kq2` and embed snippets.

Prefer the API? Mint an API key under API keys and run:

```bash
curl -X POST https://postbag.withfaahim.com/v1/quickstart \
  -H "Authorization: Bearer pb_live_…" -H "content-type: application/json" \
  -d '{ "name": "Contact", "notify_email": "you@example.com", "origin": "https://example.com" }'
```

The response contains `form.submit_url`, `embed.{html,fetch,react,astro,nextjs_action}`, a `verify` recipe and `next[]` suggestions.

## 2. Point a form at it

```html
<form action="https://postbag.withfaahim.com/s/fm_8f3kq2" method="POST">
  <label>Email<input type="email" name="email" required /></label>
  <label>Message<textarea name="message" required></textarea></label>
  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />
  <input type="hidden" name="_redirect" value="https://example.com/thanks" />
  <button type="submit">Send</button>
</form>
```

Plain HTML posts get a `303` redirect to `_redirect` (or the form's `redirect_url` setting, or a hosted thanks page). JSON posts get `{ "ok": true, "submission_id": "sb_…", "status": "received" }`.

## 3. Send a test and watch it arrive

```bash
curl -X POST https://postbag.withfaahim.com/s/fm_8f3kq2 -H "content-type: application/json" \
  -d '{ "email": "you@example.com", "message": "hello", "_test": true }'
# → { "ok": true, "submission_id": "sb_…", "status": "received", "deliveries": ["dl_…"] }
```

The submission shows up in the inbox immediately and the email arrives within seconds. `_test` submissions are routed like real ones so you can confirm the wire, but they are excluded from quotas.

## 4. Add a second destination (optional)

A Telegram chat, a webhook into your CRM, or both:

```bash
curl -X POST https://postbag.withfaahim.com/v1/destinations -H "Authorization: Bearer pb_live_…" \
  -d '{ "type": "telegram", "name": "Sales chat", "config": { "bot_token": "123:abc", "chat_id": "-100…" } }'
curl -X POST https://postbag.withfaahim.com/v1/routes -H "Authorization: Bearer pb_live_…" \
  -d '{ "form_id": "fm_8f3kq2", "destination_id": "ds_…" }'
```

That is the solo-dev path. Streams, mappings, schemas, windows and digests exist for when you need them and stay out of the way until you do. See [Routing](/docs/routing/).
