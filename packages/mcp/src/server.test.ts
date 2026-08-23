import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { describe, expect, it } from "vitest"

import { createServer } from "./server.js"

interface CapturedRequest {
  readonly url: string
  readonly method: string
  readonly headers: Record<string, string>
  readonly body: string | undefined
}

interface FakeFetchHandle {
  readonly fetchImpl: typeof fetch
  readonly calls: CapturedRequest[]
}

/** A fake `fetch` that records every call and dispatches by exact pathname to a handler. */
function fakeFetch(handlers: Record<string, () => Response>): FakeFetchHandle {
  const calls: CapturedRequest[] = []
  const fetchImpl: typeof fetch = (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof Request ? input.url : input.toString()
    const method = init?.method ?? "GET"
    // Normalize every HeadersInit shape so assertions do not depend on capitalization
    // or on whether the client needed to override Authorization for a capability scheme.
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value
    })
    calls.push({
      url,
      method,
      headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    })

    const pathname = new URL(url).pathname
    const handler = handlers[pathname]
    if (handler === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: "not_found", message: "no handler" } }), {
          status: 404,
        }),
      )
    }
    return Promise.resolve(handler())
  }
  return { fetchImpl, calls }
}

// eslint-disable-next-line @typescript-eslint/no-deprecated -- createServer intentionally returns the low-level Server (see server.ts)
async function connectedClient(server: Server): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test-client", version: "0.0.0" })
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
  return client
}

describe("createServer tools/list", () => {
  it("includes every generated operation, quickstart, and postbag_explain", async () => {
    const { fetchImpl } = fakeFetch({})
    const server = createServer({
      apiKey: "pb_live_test",
      apiUrl: "https://api.example.test",
      fetchImpl,
    })
    const client = await connectedClient(server)

    const result = await client.listTools()
    const names = result.tools.map((tool) => tool.name)

    expect(names.length).toBeGreaterThanOrEqual(61) // 59+ generated + quickstart + explain
    expect(names).toContain("postbag_quickstart")
    expect(names).toContain("postbag_explain")

    const formsCreate = result.tools.find((tool) => tool.name === "forms_create")
    expect(formsCreate).toBeDefined()
    expect(formsCreate?.inputSchema.type).toBe("object")
    expect(Object.keys(formsCreate?.inputSchema.properties ?? {})).toContain("name")

    // webhooks_create's body schema does mark fields required in api/openapi.yaml — a solid
    // check that `required` survives the openapi.yaml -> operations.json -> tool pipeline.
    const webhooksCreate = result.tools.find((tool) => tool.name === "webhooks_create")
    expect(webhooksCreate?.inputSchema.required).toEqual(expect.arrayContaining(["url", "events"]))
  })
})

describe("createServer tools/call", () => {
  it("creates a public sandbox without configuring an API key", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "/v1/public/sandboxes": () =>
        new Response(JSON.stringify({ sandbox: { id: "fm_123" } }), { status: 201 }),
    })
    const server = createServer({ apiUrl: "https://api.example.test", fetchImpl })
    const client = await connectedClient(server)

    const result = await client.callTool({
      name: "public_sandboxes_create",
      arguments: {
        name: "Contact",
        "idempotency-key": "2ad31f6e-63f0-42c8-b222-e2c834935e19",
      },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.headers["authorization"]).toBeUndefined()
    expect(calls[0]?.headers["idempotency-key"]).toBe("2ad31f6e-63f0-42c8-b222-e2c834935e19")
    expect(result.isError).toBeFalsy()
  })

  it("issues GET /v1/forms/<id> with the bearer header for forms_get", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "/v1/forms/fm_123": () =>
        new Response(JSON.stringify({ id: "fm_123", name: "Contact" }), { status: 200 }),
    })
    const server = createServer({
      apiKey: "pb_live_secret",
      apiUrl: "https://api.example.test",
      fetchImpl,
    })
    const client = await connectedClient(server)

    const result = await client.callTool({ name: "forms_get", arguments: { formId: "fm_123" } })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://api.example.test/v1/forms/fm_123")
    expect(calls[0]?.method).toBe("GET")
    expect(calls[0]?.headers["authorization"]).toBe("Bearer pb_live_secret")
    expect(result.isError).toBeFalsy()
    const content = result.content as { readonly type: string; readonly text: string }[]
    expect(JSON.parse(content[0]?.text ?? "{}")).toMatchObject({ id: "fm_123" })
  })

  it("sends a JSON body for forms_create", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "/v1/forms": () => new Response(JSON.stringify({ form: { id: "fm_new" } }), { status: 201 }),
    })
    const server = createServer({
      apiKey: "pb_live_secret",
      apiUrl: "https://api.example.test",
      fetchImpl,
    })
    const client = await connectedClient(server)

    await client.callTool({
      name: "forms_create",
      arguments: { name: "Contact form", project: "site" },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe("POST")
    expect(calls[0]?.headers["content-type"]).toBe("application/json")
    expect(JSON.parse(calls[0]?.body ?? "{}")).toMatchObject({
      name: "Contact form",
      project: "site",
    })
  })

  it("uses a Sandbox capability instead of Bearer auth for public_sandboxes_get", async () => {
    const { fetchImpl, calls } = fakeFetch({
      "/v1/public/sandboxes/fm_123": () =>
        new Response(JSON.stringify({ id: "fm_123", submissions: [] }), { status: 200 }),
    })
    const server = createServer({
      apiKey: "pb_live_secret",
      apiUrl: "https://api.example.test",
      fetchImpl,
    })
    const client = await connectedClient(server)

    const result = await client.callTool({
      name: "public_sandboxes_get",
      arguments: { id: "fm_123", authorization: "Sandbox pbs_test" },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.headers["authorization"]).toBe("Sandbox pbs_test")
    expect(result.isError).toBeFalsy()
  })

  it("surfaces an API error as isError with the error code in the text", async () => {
    const { fetchImpl } = fakeFetch({
      "/v1/forms/fm_missing": () =>
        new Response(
          JSON.stringify({
            error: { code: "not_found", message: "No such form", hint: "Check the form id." },
          }),
          { status: 404 },
        ),
    })
    const server = createServer({
      apiKey: "pb_live_secret",
      apiUrl: "https://api.example.test",
      fetchImpl,
    })
    const client = await connectedClient(server)

    const result = await client.callTool({ name: "forms_get", arguments: { formId: "fm_missing" } })

    expect(result.isError).toBe(true)
    const content = result.content as { readonly type: string; readonly text: string }[]
    expect(content[0]?.text).toContain("not_found")
    expect(content[0]?.text).toContain("Check the form id.")
  })
})

describe("createServer resources/read", () => {
  it("reads postbag://llms.txt", async () => {
    const { fetchImpl } = fakeFetch({
      "/llms.txt": () => new Response("# Postbag\n\nAgent onboarding guide.", { status: 200 }),
    })
    const server = createServer({
      apiKey: "pb_live_secret",
      apiUrl: "https://api.example.test",
      fetchImpl,
    })
    const client = await connectedClient(server)

    const result = await client.readResource({ uri: "postbag://llms.txt" })

    expect(result.contents).toHaveLength(1)
    const [content] = result.contents
    expect(content?.mimeType).toBe("text/markdown")
    expect(content !== undefined && "text" in content ? content.text : "").toContain(
      "Agent onboarding guide",
    )
  })
})
