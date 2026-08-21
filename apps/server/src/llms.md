# Postbag

Postbag is a form backend that routes. Websites `POST` to it; it stores every
submission durably and delivers it to email, Telegram, webhooks, and other systems
according to rules you configure. It is multi-tenant, self-hostable, and
agent-native: everything a human can do in the dashboard, an agent can do with an
API key.

## Getting an API key without a browser

No key yet? Two calls and one human step, no dashboard required:

1. `POST {{APP_URL}}/v1/auth/request-code {"email":"you@example.com"}` — emails a
   6-digit code, good for 10 minutes. Always 200 for a well-formed address.
2. A human reads the code out of their inbox and gives it to you.
3. `POST {{APP_URL}}/v1/auth/verify-code {"email":"you@example.com","code":"123456"}`
   — returns `{ api_key: "pb_live_…", organization, next }`. A new email provisions
   an organization first; an existing email reuses its own. The key is shown once.

Save it as `POSTBAG_API_KEY` or in `~/.config/postbag/credentials.json` (the CLI's
`postbag login` does this for you and also drives this exact flow — run it with no
arguments, or non-interactively with `--email`/`--code`). Then write a
`postbag.json` in the site repo (`form_id`, `submit_url`, `project`) once you've
created a form, so later sessions find the wiring without asking again.

## The one idea

A submission is a row before it is anything else. Delivery is an outbox drained by
a worker. Spam, quota, and rate-limit outcomes are **stored with a status, never
dropped**.

## Vocabulary

| Word | Meaning |
|---|---|
| `organization` | The tenant. Owns everything below. |
| `project` | A folder for forms. Never a routing boundary. |
| `form` | The thing a website posts to (`POST /s/{formId}`). |
| `submission` | One received payload. |
| `form_schema` | A versioned, immutable declaration of what a form collects. |
| `stream` | A named group of forms with a shared output shape. |
| `stream_schema` | The outbound contract a stream's routes deliver. |
| `mapping` | A form's field → stream field assignment. |
| `destination` | Somewhere submissions can go (email, telegram, webhook, …). |
| `route` | form/stream → destination, with rules (window, quality, digest). |
| `delivery` | One attempt-tracked send of one submission via one route. |
| `drift` | A change in what a form actually receives vs. its declared schema. |

## The three calls that matter

1. `GET {{APP_URL}}/v1/me` — who am I, which organization, which scopes, what
   already exists. Call this first with your API key.
2. `POST {{APP_URL}}/v1/quickstart` — one call to a working, routed form.
   Idempotent by `(project, name)`. Returns a `submit_url`, embed snippets, and a
   verification recipe.
3. `POST /s/{formId}` — submit to a form. No auth. Accepts
   `application/json`, `application/x-www-form-urlencoded`, and
   `multipart/form-data` (text fields only in Phase 1). Pass `_test: true` to get a
   `submission_id` and `deliveries[]` back so you can poll
   `GET /v1/deliveries/{id}` and see `sent` — this is how you verify a destination
   without a browser or a human.

## Conventions

- IDs are prefixed and self-describing: `fm_…` form, `sb_…` submission, `st_…`
  stream, `ds_…` destination, `rt_…` route, `dl_…` delivery, `prj_…` project.
- Auth: `Authorization: Bearer pb_live_…` (or a dashboard session cookie). Scopes
  are `manage`, `read`, `submit`.
- Every error is `{ error: { code, message, hint, docs } }` — `hint` says what to
  do next, `docs` is a deep link.
- Every create response includes `next[]`: ready-to-send follow-up calls.
- `Idempotency-Key` header is honoured on every `POST` under `/v1`. Creates also
  support `if_exists: "return"` for idempotency by `(project, slug)` / `(org, slug)`.
- Cursor pagination: `?cursor=&limit=` (max 200), opaque cursors.

## Full contract

`GET {{APP_URL}}/openapi.json` is generated from the live route definitions — it is
always current. Start there for exact request/response shapes.
