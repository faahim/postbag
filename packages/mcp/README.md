# @postbag/mcp

An [MCP](https://modelcontextprotocol.io) server for [Postbag](https://postbag.dev) — a form
backend that routes. Every `/v1` API operation is exposed as a tool, one-to-one, plus two
convenience tools and a handful of resources. If you can do it in the Postbag dashboard, an
agent holding only an API key can do it here.

**Tool names are the API operation ids** — `forms_create`, `submissions_list`,
`destinations_test`, `routes_create`, and so on. If you know the [API contract](https://postbag.dev/docs/api/),
you already know the tool names.

## Use it

Requires Node ≥ 22 and a Postbag API key. Mint one at `https://postbag.dev/app` (Settings → API
keys) or with the [`postbag` CLI](https://www.npmjs.com/package/postbag) (`postbag login`).

### Claude Code

```sh
claude mcp add postbag -e POSTBAG_API_KEY=pb_live_your_key -- npx -y @postbag/mcp
```

### Claude Desktop / Cursor / any stdio MCP client

Add to your client's MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "postbag": {
      "command": "npx",
      "args": ["-y", "@postbag/mcp"],
      "env": {
        "POSTBAG_API_KEY": "pb_live_your_key"
      }
    }
  }
}
```

`POSTBAG_API_URL` defaults to `https://postbag.dev`; set it only if you self-host. Both can also
be passed as `--api-key`/`--api-url` flags on the command instead of env vars.

## First call

If you're new to Postbag, call **`postbag_explain`** first — it returns the same guide as
`GET /llms.txt`: what Postbag is, the vocabulary (Form, Submission, Stream, Destination, Route,
Delivery), and the calls that matter. Then call **`postbag_quickstart`** to go from nothing to a
working, routed, verified form in one call — it creates the project (if missing), the form, a
destination (email, Telegram or webhook) and a route, and returns an embeddable snippet plus a
`next` list of good follow-up calls.

Everything `postbag_quickstart` does is also available as individual tools (`forms_create`,
`destinations_create`, `routes_create`, …) — quickstart is a convenience, not a special path.

## Tools

- **59 generated tools**, one per `/v1` operation — `me_get`, `forms_list`, `forms_create`,
  `forms_get`, `forms_update`, `forms_delete`, `forms_schema_get`, `forms_schema_publish`,
  `streams_create`, `destinations_create`, `destinations_test`, `routes_create`,
  `deliveries_retry`, `webhooks_create`, `api_keys_create`, … the full contract, kept in sync
  with `api/openapi.yaml` by `pnpm generate` (see below).
- **`postbag_quickstart`** — see above.
- **`postbag_explain`** — returns `GET /llms.txt`.

Each generated tool's input schema merges the operation's path params, query params and JSON
body into one flat object. Body fields keep their API names; a path or query param whose name
collides with a body field is exposed as `path_<name>` / `query_<name>` instead (rare in
practice — check the tool's schema if you're not sure).

Every call returns `content: [{ type: "text", text: "<JSON>" }]` on success. API errors come
back as `isError: true` with the API's `{ error: { code, message, hint, docs } }` envelope in the
text — the server never throws for an ordinary API error.

## Resources

| URI | Returns |
|---|---|
| `postbag://forms` | `GET /v1/forms` — every form in your org |
| `postbag://forms/{formId}` | `GET /v1/forms/{formId}` |
| `postbag://forms/{formId}/schema` | `GET /v1/forms/{formId}/schema` |
| `postbag://streams/{streamId}/schema` | `GET /v1/streams/{streamId}/schema` |
| `postbag://openapi` | `GET /openapi.json` — the full contract |
| `postbag://llms.txt` | `GET /llms.txt` — the agent onboarding guide |

## Development

```sh
pnpm --filter @postbag/mcp generate  # regenerate src/generated/operations.json from ../../api/openapi.yaml
pnpm --filter @postbag/mcp build     # tsc -> dist/, plus copying the generated catalogue
pnpm --filter @postbag/mcp test      # vitest
```

`src/generated/operations.json` is committed — the published package never reads
`api/openapi.yaml` at runtime, only at generation time. A test fails if it's stale; run
`pnpm generate` again and commit the result.

## License

MIT
