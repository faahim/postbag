import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"

import type { ResolvedConfig } from "./config.js"
import type { FetchLike } from "./httpClient.js"
import { OPERATIONS } from "./operations.js"
import { RESOURCES, RESOURCE_TEMPLATES, readResource } from "./resources.js"
import { EXPLAIN_TOOL_NAME, buildToolCatalogue, callExplainTool, callOperationTool } from "./tools.js"

export const SERVER_NAME = "postbag-mcp"
export const SERVER_VERSION = "0.1.0"

export interface CreateServerOptions extends ResolvedConfig {
  readonly fetchImpl?: FetchLike
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Builds the low-level MCP `Server`: one tool per `/v1` operation, plus quickstart/explain,
 * plus form and stream schema resources. See `docs/AGENT-NATIVE.md` §6 and
 * `tasks/job-F-cli-mcp.md` Phase 3 for the contract this implements.
 *
 * The SDK's higher-level `McpServer` builds `inputSchema` from Zod schemas, which would force
 * every tool's parameters through a runtime JSON-Schema-to-Zod conversion. The low-level
 * `Server` — deprecated for that exact reason, but still the documented "advanced use cases"
 * escape hatch — lets us hand it the raw JSON Schema the openapi.yaml already carries.
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated -- see the doc comment above
export function createServer(options: CreateServerOptions): Server {
  const config: CreateServerOptions = {
    apiKey: options.apiKey,
    apiUrl: options.apiUrl,
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
  }
  const { tools, index } = buildToolCatalogue(OPERATIONS)

  // eslint-disable-next-line @typescript-eslint/no-deprecated -- see the doc comment above
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }))

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: rawArgs } = request.params
    const args = isRecord(rawArgs) ? rawArgs : {}

    if (name === EXPLAIN_TOOL_NAME) return callExplainTool(config)

    const entry = index.get(name)
    if (entry === undefined) {
      return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: { code: "unknown_tool", message: `No such tool: ${name}` } }) }] }
    }
    return callOperationTool(config, entry, args)
  })

  server.setRequestHandler(ListResourcesRequestSchema, () => ({ resources: RESOURCES }))
  server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({ resourceTemplates: RESOURCE_TEMPLATES }))
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const content = await readResource(config, request.params.uri)
    return { contents: [content] }
  })

  return server
}
