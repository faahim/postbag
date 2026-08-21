import createOpenapiClient, { type Client, type Middleware } from "openapi-fetch"

import type { paths } from "./schema.js"

export type PostbagClient = Client<paths>

export type CreateClientOptions = {
  /** Base URL of the Postbag API, e.g. `https://api.postbag.dev` or `http://localhost:3000`. */
  readonly baseUrl: string
  /** A `pb_live_…` API key. Sent as `Authorization: Bearer <apiKey>`. Omit for cookie-session auth. */
  readonly apiKey?: string
  /** Fetch `credentials` mode. Defaults to `"include"` so the dashboard's session cookie is sent. */
  readonly credentials?: RequestCredentials
  /** Override the underlying `fetch` implementation (Node/tests). */
  readonly fetch?: typeof globalThis.fetch
}

/**
 * Build a typed client for the Postbag `/v1` API. This is the only way the dashboard,
 * CLI, MCP server and any agent script talk to Postbag — nothing bypasses `/v1`.
 */
export function createClient(options: CreateClientOptions): PostbagClient {
  const client = createOpenapiClient<paths>({
    baseUrl: options.baseUrl,
    credentials: options.credentials ?? "include",
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  })

  if (options.apiKey !== undefined) {
    const auth: Middleware = {
      onRequest({ request }) {
        request.headers.set("Authorization", `Bearer ${options.apiKey}`)
        return request
      },
    }
    client.use(auth)
  }

  return client
}
