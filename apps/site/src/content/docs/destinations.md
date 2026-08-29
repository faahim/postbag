---
title: "Destinations: email, Telegram and webhook configuration"
description: "Configuration reference for Postbag destinations: email (to, cc, subject_template, from_name, Reply-To), Telegram (bot_token, chat_id, template), webhook (url, secret, headers), the /test endpoint, redaction, and retry limits per type."
order: 24
section: Guides
---

Destinations are organization-level and reusable across routes. Create with `POST /v1/destinations`, test with `POST /v1/destinations/{id}/test`.

## Email

```json
{
  "type": "email",
  "name": "Ops inbox",
  "config": {
    "to": ["ops@example.com"],
    "cc": [],
    "subject_template": "New submission: {{form.name}}",
    "from_name": "Forms"
  }
}
```

Sent through Resend from a Postbag domain (or your `MAIL_FROM` when self-hosted). `Reply-To` is set from the submission: `settings.reply_to_field` on the form, or the first field that looks like an email. Templates see `form`, `submission`, `data` and `meta`. Max attempts: 8.

## Telegram

```json
{
  "type": "telegram",
  "name": "Sales chat",
  "config": {
    "bot_token": "123456:ABC…",
    "chat_id": "-1001234567890",
    "template": "New lead from {{form.name}}: {{data.name}}"
  }
}
```

Create a bot with @BotFather, add it to the chat, and use the chat id (negative for groups). Messages are HTML-formatted with values escaped. Max attempts: 8.

## Webhook

```json
{
  "type": "webhook",
  "name": "CRM",
  "config": {
    "url": "https://crm.example.com/postbag",
    "secret": "whsec_…",
    "headers": { "X-Source": "postbag" }
  }
}
```

JSON POST with `Postbag-Delivery`, `Postbag-Event` and, when a secret is set, `Postbag-Signature`. 10 s timeout, max 10 attempts. See [Webhook signatures](/docs/webhooks/).

## Attachment links

When a Submission has attachments, Postbag keeps `fl_…` references in its data and
adds a signed, short-lived download link to the Delivery context. Email and Telegram
render the links; webhook JSON carries them in `attachments[]`. Postbag never sends
the binary object to a Destination and never exposes a public object URL.

## Testing

`POST /v1/destinations/{id}/test` sends a sample payload through the real adapter and returns `{ ok, status_code, latency_ms, response_excerpt, error? }` inline. Secrets are never echoed back: `GET /v1/destinations/{id}` returns a redacted config.

## Health

A destination that fails repeatedly is marked failing and raises `destination.failing`; alerts are throttled per destination so a down endpoint does not produce a storm.

## What is next

`slack` and `discord` (incoming-webhook URL plus a template) are accepted by the API schema and are the next adapters. Native destinations follow only once the webhook path has proven a pattern.
