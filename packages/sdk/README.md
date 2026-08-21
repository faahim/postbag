# @postbag/sdk

Typed TypeScript client for the Postbag API. Generated from the server's `/openapi.json`
(the truth — see `api/openapi.yaml`), so it is always in sync with what `apps/server`
actually serves.

```ts
import { createClient, submit } from "@postbag/sdk"

// Management API (/v1/*) — cookie session (dashboard) or an API key (agents, scripts).
const client = createClient({ baseUrl: "https://api.postbag.dev", apiKey: "pb_live_…" })
const { data, error } = await client.GET("/v1/forms")

// Public submit endpoint (/s/{formId}) — no auth, works from a browser or a server.
await submit("https://api.postbag.dev/s/fm_8f3kq2", { email: "you@example.com" })
```

## Regenerating

```
pnpm --filter @postbag/sdk generate   # requires a running server on :3000
```

This overwrites `src/schema.d.ts`, which is committed so consumers don't need a live
server to typecheck.
