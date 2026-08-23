# Agent-native

"Agent-native" is a property the whole surface has, not a feature bolted on. The
test (Principle 8): an agent with no credentials can prove durable receipt, then an
agent holding an API key can claim and route the same Form without a browser.

## 1. Discoverable

| URL                                                                          | Returns                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET https://api.postbag.dev/` with `Accept: text/markdown` (or `/llms.txt`) | The agent onboarding page: what Postbag is, the three calls that matter, the vocabulary, links below.              |
| `GET /openapi.json`                                                          | The full contract.                                                                                                 |
| `GET /v1/me`                                                                 | Who am I, which org, which scopes, plan limits, what exists already (counts). The first call an agent should make. |
| Every error                                                                  | `{ error: { code, message, hint, docs } }` — `hint` says what to do, `docs` is a deep link.                        |
| Every create response                                                        | Includes `next`: a short list of suggested follow-up calls with ready-to-use bodies.                               |

## 2. One call to a working form

### Finish first, claim after

`POST /v1/public/sandboxes` creates a 24-hour sandbox Form before an account exists.
It requires a CSPRNG-generated lowercase UUIDv4 `Idempotency-Key` and accepts only a
name, optional site origin and optional explicitly supplied claim email. The response
returns the stable submit URL, embed snippets, a sandbox capability token, verification
calls and `/app/claim#token=…`.

The agent may store up to five 16 KiB test Submissions, then verify them with
`GET /v1/public/sandboxes/{id}` and `Authorization: Sandbox <token>`. The sandbox
stores but never creates Destinations, Routes, Deliveries, Events or outbound traffic.

Claim through the browser, or use the existing email-code flow to obtain a manage key
and call `POST /v1/sandboxes/{id}/claim` with `Postbag-Sandbox-Token`. Claiming keeps
the Form id and submit URL, copies the accepted rows as tests with their original
timestamps, and never delivers them retroactively. Only new submissions can route
after a Destination and Route are configured.

### Authenticated quickstart

```
POST /v1/quickstart
{ "name": "Portfolio contact", "notify_email": "me@example.com",
  "origin": "https://faahim.dev", "project": "portfolio" }
```

creates (idempotently, by name within project): the project if missing, the form,
an `email` destination (verified later by magic link if not already verified), a
direct route, and returns:

```jsonc
{
  "form": { "id": "fm_8f3kq2", "submit_url": "https://api.postbag.dev/s/fm_8f3kq2" },
  "embed": {
    "html":  "<form action=\"https://api.postbag.dev/s/fm_8f3kq2\" method=\"POST\">…</form>",
    "fetch": "await fetch('https://api.postbag.dev/s/fm_8f3kq2', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })",
    "react": "…", "astro": "…", "nextjs_action": "…"
  },
  "verify": { "curl": "curl -X POST … -d '{\"_test\":true,\"email\":\"…\"}'",
              "then": "GET /v1/forms/fm_8f3kq2/submissions?limit=1" },
  "next": [ { "why": "Add Telegram", "call": "POST /v1/destinations", "body": { … } } ]
}
```

Everything the quickstart does is also available as individual calls; quickstart is
a convenience, not a special path.

## 3. Verifiable

- `POST /s/{id}` with `_test: true` stores a submission flagged `test`, routes it,
  and returns the `submission_id` + the `delivery_ids` created, so the agent can poll
  `GET /v1/deliveries/{id}` and see `sent`. Test submissions are excluded from
  digests and quotas and are auto-purged after 24 h.
- `POST /v1/destinations/{id}/test` sends a sample payload and returns the provider's
  response inline.

## 4. Schema-aware, fleet-aware

An agent building the sixteenth site in a fleet:

```
GET  /v1/streams/vending-leads            → current stream schema + list of sources + a form template
POST /v1/forms  { "from_template": "st_…", "name": "TCG Automat contact", "tags": ["vending"], "schema_mode": "managed" }
                                          → form pre-attached to the stream with a valid mapping,
                                            schema served at /s/{id}/schema, embed snippets rendered from it
```

The agent cannot produce a form the stream doesn't understand: an incomplete mapping
is a 422 with the missing fields listed, at creation time.

## 5. Idempotent and safe to retry

`Idempotency-Key` header honoured on every `POST`. Creates are idempotent by
`(project, slug)` / `(org, slug)` when `if_exists: "return"` is passed — agents
re-running a setup script get the same objects back, not duplicates or errors.

## 6. Clients

All three are thin over the generated SDK; none has logic the API lacks.

- **CLI** — `npx postbag init` (interactive or `--yes` with flags) runs quickstart and
  writes `postbag.json` into the repo (`form_id`, `submit_url`, `project`), so later
  sessions — human or agent — can find the wiring. `postbag submissions tail`,
  `postbag destinations test`, `postbag schema publish`.
  Before login, `postbag sandbox create|status`; after login, `postbag sandbox claim`.
- **MCP server** — `npx @postbag/mcp`, tools mirror the API one-to-one plus
  `postbag_quickstart` and `postbag_explain` (returns the llms.txt). Resources expose
  forms and stream schemas.
- **SDK** — `@postbag/sdk`, generated from OpenAPI; also the submit helper
  `submit(formId, data)` for browser/server use.

## 7. For agents building _with_ Postbag in a site repo

`postbag.json` at the repo root is the convention. `CLAUDE.md`/`AGENTS.md` templates
that Smedja and other factories scaffold should include:

> Forms on this site post to Postbag. Config in `postbag.json`. To add a form:
> `npx postbag forms create --name … --tags …`. Never hand-write a submit URL.
