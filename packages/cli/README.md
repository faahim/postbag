# postbag

The [Postbag](https://postbag.dev) CLI — create, inspect and route forms from the
terminal or an agent session. Every command is a thin wrapper over the same `/v1`
API the dashboard uses (via [`@postbag/sdk`](https://www.npmjs.com/package/@postbag/sdk));
nothing here has logic the API lacks.

## Install

```sh
npm i -g postbag
# or, without installing anything:
npx postbag init
```

Requires Node ≥ 22.

## 60 seconds to a working form

```sh
cd my-site
postbag login                    # paste an API key, or get one by email code — no browser needed
postbag init --yes                # runs quickstart, writes postbag.json into this repo
```

`postbag init` creates (idempotently) a project and a form, wires up whichever of
`--email`/`--telegram` you passed as a destination, and prints a ready-to-paste embed
snippet plus a `curl` command to verify delivery. Run it again later and it just prints
the existing `postbag.json` — pass `--force` to redo the quickstart.

```sh
postbag forms list
postbag forms create --name "Contact form" --tags site,contact
postbag submissions tail --form fm_8f3kq2      # watch new submissions arrive, Ctrl-C to stop
postbag destinations test dst_abc123           # send a sample payload right now
```

Run `postbag --help` or `postbag <command> --help` any time — every command has a
one-line description and the root help has worked examples.

## Config resolution

Each of `--api-key`/`--api-url` is resolved in this order, first match wins:

1. `--api-key <key>` / `--api-url <url>` flags
2. `POSTBAG_API_KEY` / `POSTBAG_API_URL` environment variables
3. `postbag.json` in the current directory (`api_url` only — it never stores a key)
4. `~/.config/postbag/credentials.json` (written by `postbag login`; respects
   `XDG_CONFIG_HOME`), mode `0600`
5. `https://postbag.dev` as the default `api_url`; no default API key

`postbag login [--api-key <key>]` verifies the key against `GET /v1/me` before saving
it. With no `--api-key` and no `POSTBAG_API_KEY`, it prompts `Email (or paste an API
key)`: paste a key and it verifies it the same way; give an email instead and it sends
a 6-digit code (`POST /v1/auth/request-code`), asks for the code, and verifies it
(`POST /v1/auth/verify-code`) — no dashboard, no browser, just a human reading a code
out of their inbox once. The same flow works with no TTY, in two invocations:

```sh
postbag login --email you@example.com                 # sends the code
postbag login --email you@example.com --code 123456   # verifies it, saves the key
```

`postbag logout` forgets the saved key. `postbag whoami` prints who the current key
belongs to.

## Output

Tables on a human terminal, JSON everywhere else — the same command works for a person
watching a shell and an agent piping output into `jq`:

```sh
postbag forms list                              # compact table, ids first
postbag --json forms list                       # pretty-printed JSON (also the default
                                                  # whenever stdout isn't a TTY, e.g. piped)
```

Every error prints `code: message` on stderr, then `hint:`/`docs:` lines when the API
supplied them, and exits `1`. In `--json` mode the raw `{ "error": { "code", "message",
"hint", "docs" } }` object goes to stderr instead. The API key is never printed.

## Agent usage

No key yet? An agent can get one without a browser or asking a human to open the
dashboard — the human only reads a 6-digit code out of their inbox:

```sh
postbag login --email the-human@example.com    # "Code sent to the-human@example.com — check your inbox"
postbag login --email the-human@example.com --code 123456
```

Then it's a normal key, resolved the same way every other command resolves one:

```sh
POSTBAG_API_KEY=pb_live_xxxxx postbag --json forms list
POSTBAG_API_KEY=pb_live_xxxxx postbag --json submissions list --form fm_8f3kq2 --status quarantined
POSTBAG_API_KEY=pb_live_xxxxx postbag api POST /v1/routes --data '{"form_id":"fm_1","destination_id":"dst_1"}'
```

`postbag api <METHOD> <path> [--data '{json}']` is a generic escape hatch to any `/v1`
path, with the same auth and output rules as every other command — useful for whatever
this CLI hasn't grown a dedicated command for yet. `postbag explain` prints the agent
onboarding page (`GET /llms.txt`); `postbag openapi` prints the full contract
(`GET /openapi.json`).

## `postbag.json`

The convention any agent or human working in a site repo should follow (see
[`docs/AGENT-NATIVE.md`](https://github.com/faahim/postbag/blob/main/docs/AGENT-NATIVE.md)
§7): forms on this site post to Postbag, and the wiring lives in `postbag.json` at the
repo root, written by `postbag init`:

```json
{
  "form_id": "fm_8f3kq2",
  "submit_url": "https://api.postbag.dev/s/fm_8f3kq2",
  "project": "my-site",
  "api_url": "https://postbag.dev"
}
```

Never hand-write a submit URL — run `postbag init` once, then `postbag forms create
--name … --tags …` for additional forms in the same project.

## Command reference

```
postbag login [--api-key <key>] [--email <addr>] [--code <digits>] | logout | whoami
postbag init [--name] [--email] [--telegram <chatId>] [--project] [--yes] [--force]
postbag forms list|get <id>|create|update <id>|delete <id>|embed <id>
postbag submissions list|get <id>|tail --form <id> [--interval <s>]
postbag schema get <formId>|publish <formId> --file schema.json|infer <formId>|versions <formId>
postbag streams list|get <id>|create|delete <id>
postbag streams sources add|remove|list
postbag destinations list|get <id>|create --type email|telegram|webhook|slack|discord|test <id>|delete <id>
postbag routes list|get <id>|create --from form:<id>|stream:<id> --to <destinationId>|delete <id>
postbag deliveries list|get <id>|retry <id>
postbag events list
postbag webhooks list|create --url … --events a,b|delete <id>
postbag projects list|create
postbag api-keys list|create|revoke <id>
postbag explain
postbag openapi
postbag api <METHOD> <path> [--data '{json}']
```

Every `create`/`update`/`publish` command also accepts `--data '{json}'` as the full
request body — flags, when also passed, override matching fields in `--data`.

## Links

- [Full API reference](https://postbag.dev/docs/api/)
- [`@postbag/sdk`](https://www.npmjs.com/package/@postbag/sdk) — the typed client this
  CLI is built on
- [`@postbag/mcp`](https://www.npmjs.com/package/@postbag/mcp) — an MCP server over the
  same API, for agents that speak MCP instead of a shell
