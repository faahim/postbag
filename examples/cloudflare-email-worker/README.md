# Email → Postbag (Cloudflare Email Routing Worker)

Turn a mailbox into a Postbag Form. Every email sent to an address on your Cloudflare
zone becomes a Submission: stored durably, readable over `/v1`, and routable to any
Destination. This is how you give an agent, a CRM, or a webhook a mailbox without
running IMAP.

```
sender ──SMTP──▶ Cloudflare Email Routing ──▶ this Worker ──POST /s/{formId}──▶ Postbag
                                                                                  │
                                              agent / dashboard ◀── GET /v1/forms/{formId}/submissions
```

## What lands in the Submission

The Worker always posts `multipart/form-data` (one field shape with or without files, and
a MiB-scale body ceiling instead of the 256 KiB JSON limit). Postbag stores every part
as a string, so list and object fields below arrive JSON-encoded, and numbers and
booleans arrive as `"581"` / `"true"`.

| field | source |
|---|---|
| `from`, `to` | SMTP envelope (trustworthy; header addresses can be spoofed) |
| `from_name`, `from_address`, `reply_to[]`, `cc[]` | parsed headers |
| `subject`, `text`, `html`, `date` | parsed body (text/html capped, see `BODY_CAP_BYTES`) |
| `text_truncated`, `html_truncated` | `true` when a body was cut at the cap |
| `message_id`, `in_reply_to`, `headers{}` | threading headers, plus `references`, `list-id`, `x-priority` |
| `raw_size` | bytes of the original MIME message |
| `attachments[]` | metadata: `filename`, `mime_type`, `size`, `content_id` |
| `file_1`, `file_2`, … | the attachments themselves, as Postbag `fl_` references |
| `attachments_dropped`, `attachments_dropped_reason` | present when files were refused and the email was re-posted without them |

## Guarantees

1. **No silent loss.** If Postbag does not acknowledge the Submission and no
   forwarding copy exists, the Worker rejects the message so the sending server
   retries or bounces.
2. **Attachments are best effort.** If the multipart upload is refused (plan
   limits, size), the same email is re-posted as JSON without files.
3. **Re-deliveries de-duplicate.** The `Message-ID` is sent as `Idempotency-Key`;
   Postbag returns the existing receipt instead of creating a second Submission.

## Setup

1. Create a Form (dashboard, or `postbag forms create --name "Inbox"`) and copy its
   `submit_url`.
2. Deploy the Worker:

   ```sh
   npm install
   npx wrangler deploy --var POSTBAG_SUBMIT_URL:https://postbag.dev/s/fm_xxxxxxxxxxxx
   ```

3. Point an address at it. In the Cloudflare dashboard: *Email* → *Email Routing* →
   *Routing rules* → *Create address*, action **Send to a Worker**. Or from the CLI:

   ```sh
   npx wrangler email routing rules create yourdomain.com --name "inbox → Postbag" \
     --match-type literal --match-field to --match-value inbox@yourdomain.com \
     --action-type worker --action-value postbag-email-worker
   ```

4. Send yourself an email, then:

   ```sh
   postbag submissions list --form fm_xxxxxxxxxxxx --limit 1
   ```

### Variables

| var | required | meaning |
|---|---|---|
| `POSTBAG_SUBMIT_URL` | yes | the Form's submit URL |
| `FORWARD_TO` | no | also forward every email to this **verified** destination address (safety net during rollout) |
| `BODY_CAP_BYTES` | no | cap for `text` and `html` each, default `100000` (JSON submits are limited to 256 KiB) |

Set them with `--var` at deploy time, in `wrangler.jsonc` under `vars`, or as secrets.
Nothing here is secret, but the values are deployment-specific, so the committed
config leaves them blank.

## Local test

```sh
printf 'POSTBAG_SUBMIT_URL=https://postbag.dev/s/fm_xxxxxxxxxxxx\n' > .dev.vars
npm run dev            # in one terminal
npm run test:local     # in another: posts test/sample.eml to the local email handler
```

`wrangler dev` exposes the email handler at `/cdn-cgi/handler/email`, so the sample
message goes through the real code path and lands in your real Form.

## Notes

- Free-plan Forms accept 2 MiB per attachment and 3 per Submission; larger mail
  falls back to JSON-without-files (guarantee 2). Raise limits on the Form's plan or
  self-host with your own limits.
- Postbag's spam scoring sees email-shaped bodies as ordinary text. A very long,
  link-heavy message can still be stored with status `spam`; nothing is dropped.
- To push instead of poll, add a Route from the Form to a webhook Destination.
