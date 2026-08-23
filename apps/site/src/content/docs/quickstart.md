---
title: "Quickstart: a working Form in three minutes"
description: "Create and test before signup, then claim the same Form and connect a Destination and Route for Delivery."
order: 1
section: Start
modified: "2026-08-24"
---

The fastest path starts before an account exists. You will create a sandbox Form, wire its stable submit URL, prove that Postbag stored a test, then claim it and turn on Delivery.

If you already have an API key, skip to [Start from an account](#start-from-an-account).

## Install the CLI

The `postbag` CLI is published on npm and requires Node 22 or newer:

```bash
npm install --global postbag
postbag --help
```

You can also replace `postbag` with `npx postbag` in every command below.

## Create a Form before signup

Run this from the site repository:

```bash
postbag sandbox create \
  --name "Contact" \
  --origin "https://example.com"
```

The response prints a Form id, stable submit URL, claim URL, and sandbox capability token. Save the token when it appears. Postbag shows it only in the creation response, but you can reuse it to read and claim the sandbox until it is claimed or expires. The CLI does not write it to `postbag.json` or saved credentials.

The sandbox lasts 24 hours, accepts at most five 16 KiB test Submissions, and creates no outbound traffic.

## Wire the returned submit URL

Use the exact URL returned by Postbag:

```html
<form action="https://postbag.dev/s/fm_8f3kq2" method="POST">
  <label>Email<input type="email" name="email" required /></label>
  <label>Message<textarea name="message" required></textarea></label>
  <input
    type="text"
    name="_gotcha"
    tabindex="-1"
    autocomplete="off"
    style="position:absolute;left:-10000px"
    aria-hidden="true"
  />
  <button type="submit">Send</button>
</form>
```

The creation response also includes snippets for `fetch`, React, Astro, and a Next.js action. Keep the honeypot input in the HTML version.

## Prove that Postbag received it

Send one test through the real site or post directly to the returned URL. Then read the sandbox with the capability:

```bash
curl -X POST "https://postbag.dev/s/fm_8f3kq2" \
  -H "content-type: application/json" \
  -H "Origin: https://example.com" \
  -d '{ "email": "you@example.com", "message": "hello" }'

POSTBAG_SANDBOX_TOKEN="pbs_…" postbag sandbox status
```

At this point Postbag has durably stored the Submission. There is no Delivery id yet because a sandbox cannot create Destinations, Routes, or outbound traffic.

## Claim the same Form

Authenticate by email code, then claim with the capability you saved:

```bash
postbag login --email you@example.com
postbag login --email you@example.com --code 123456
postbag sandbox claim --token "pbs_…"
```

The Form id and submit URL stay the same. The anonymous Submissions are copied into the account as tests and never deliver retroactively. Google and GitHub sign-in are optional browser alternatives when the Postbag instance has those providers configured.

## Add a Destination and Route

A Destination says where Submissions go. A Route connects this Form to that Destination. You need both before Delivery can happen.

```bash
postbag destinations create --data '{
  "type": "email",
  "name": "Contact inbox",
  "config": { "to": ["you@example.com"] }
}'

postbag routes create --from form:fm_8f3kq2 --to ds_8f3kq2
```

Use the Destination id returned by the first command. Now send a new `_test` Submission and poll its returned Delivery id until the status is `sent`, `failed`, or `dead`.

```bash
curl -X POST "https://postbag.dev/s/fm_8f3kq2" \
  -H "content-type: application/json" \
  -H "Origin: https://example.com" \
  -d '{ "email": "you@example.com", "message": "route test", "_test": true }'

postbag deliveries get dl_8f3kq2
```

## Start from an account

If you already have a manage-scoped API key, the authenticated quickstart can create the Form, an email Destination, and their Route in one idempotent call:

```bash
postbag init --yes --name "Contact" --email "you@example.com"
```

The raw HTTP equivalent is:

```bash
curl -X POST https://postbag.dev/v1/quickstart \
  -H "Authorization: Bearer pb_live_…" \
  -H "content-type: application/json" \
  -d '{
    "name": "Contact",
    "project": "website",
    "origin": "https://example.com",
    "notify_email": "you@example.com"
  }'
```

The response contains `form.submit_url`, `embed`, a browser-equivalent `verify` call, and `next[]`. Repeating the same project and Form name returns the existing Form instead of creating another one.

From here, [Routing](/docs/routing/) covers filters, windows, digests, Streams, and Mappings when the simple path needs to grow.
