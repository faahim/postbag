import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js"

import { bindingToInputSchema, buildOperationBinding, type OperationBinding } from "./binding.js"
import type { ApiClientOptions } from "./httpClient.js"
import { callJsonApi, callTextApi } from "./httpClient.js"
import type { GeneratedOperation } from "./types.js"

export const QUICKSTART_TOOL_NAME = "postbag_quickstart"
export const EXPLAIN_TOOL_NAME = "postbag_explain"

const QUICKSTART_DESCRIPTION = `The one call to make first when setting up a new form: creates (idempotently, by \
name within project) the project if missing, the form, a destination for whichever of \
notify_email/telegram/webhook you pass, and a direct route between them — a working, routed \
form in a single call. Everything it does is also available as individual tools (forms_create, \
destinations_create, routes_create) if you need more control; this is a convenience, not a \
special path.

The response's "next" array lists ready-to-use follow-up calls (e.g. adding a second \
destination), and "verify" gives you a test submission you can send immediately to confirm \
delivery before wiring up the real site. Prefer this tool over forms_create for a brand new \
form; call postbag_explain first if you haven't used Postbag before.`

const EXPLAIN_DESCRIPTION = `Returns Postbag's agent onboarding guide (the same content as GET \
/llms.txt): what Postbag is, the vocabulary (Form, Submission, Stream, Destination, Route, \
Delivery), and the handful of calls that matter. Call this first, before anything else, if \
you are not already familiar with Postbag — then call postbag_quickstart to create a working \
form.`

function toolDescription(operation: GeneratedOperation): string {
  const parts = [operation.summary, operation.description].filter(
    (part): part is string => part !== undefined && part.length > 0,
  )
  return parts.join("\n")
}

function operationToTool(operation: GeneratedOperation, binding: OperationBinding): Tool {
  return {
    name: operation.operationId,
    description: toolDescription(operation),
    inputSchema: bindingToInputSchema(binding) as Tool["inputSchema"],
  }
}

export interface ToolEntry {
  readonly operation: GeneratedOperation
  readonly binding: OperationBinding
}

export interface ToolCatalogue {
  readonly tools: readonly Tool[]
  readonly index: ReadonlyMap<string, ToolEntry>
}

export function buildToolCatalogue(operations: readonly GeneratedOperation[]): ToolCatalogue {
  const tools: Tool[] = []
  const index = new Map<string, ToolEntry>()

  for (const operation of operations) {
    const binding = buildOperationBinding(operation)
    tools.push(operationToTool(operation, binding))
    index.set(operation.operationId, { operation, binding })
  }

  const quickstart = operations.find((operation) => operation.operationId === "quickstart")
  if (quickstart !== undefined) {
    const binding = buildOperationBinding(quickstart)
    tools.push({
      name: QUICKSTART_TOOL_NAME,
      description: QUICKSTART_DESCRIPTION,
      inputSchema: bindingToInputSchema(binding) as Tool["inputSchema"],
    })
    index.set(QUICKSTART_TOOL_NAME, { operation: quickstart, binding })
  }

  tools.push({
    name: EXPLAIN_TOOL_NAME,
    description: EXPLAIN_DESCRIPTION,
    inputSchema: { type: "object", properties: {} },
  })

  return { tools, index }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Renders a path/query param value for a URL. Objects and arrays serialize as JSON. */
function paramValueToString(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value === null || value === undefined) return ""
  return JSON.stringify(value)
}

function jsonContent(value: unknown): CallToolResult["content"] {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }]
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: jsonContent({ error: { code: "invalid_tool_call", message } }) }
}

/** Builds the request for a generated operation tool call, sends it, and shapes the result. */
export async function callOperationTool(
  config: ApiClientOptions,
  entry: ToolEntry,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const { operation, binding } = entry
  let path = operation.path
  const query = new URLSearchParams()
  const body: Record<string, unknown> = {}
  let wholeBody: unknown

  for (const [propName, value] of Object.entries(args)) {
    const paramBinding = binding.paramBindings.get(propName)
    if (paramBinding !== undefined) {
      if (value === undefined) continue
      if (paramBinding.kind === "path") {
        path = path.replace(`{${paramBinding.realName}}`, encodeURIComponent(paramValueToString(value)))
      } else {
        query.set(paramBinding.realName, paramValueToString(value))
      }
      continue
    }
    if (binding.bodyMode === "whole" && propName === "body") {
      wholeBody = value
      continue
    }
    if (binding.bodyMode === "properties") {
      body[propName] = value
    }
  }

  if (path.includes("{")) {
    return errorResult(`Missing a required path parameter for ${operation.operationId} — resulting path: ${path}`)
  }

  const queryString = query.toString()
  const fullPath = queryString.length > 0 ? `${path}?${queryString}` : path

  const requestBody =
    binding.bodyMode === "whole" ? (isRecord(wholeBody) ? wholeBody : {}) : binding.bodyMode === "properties" ? body : undefined

  const result = await callJsonApi(config, operation.method, fullPath, requestBody)
  return result.ok ? { content: jsonContent(result.body) } : { isError: true, content: jsonContent(result.body) }
}

export async function callExplainTool(config: ApiClientOptions): Promise<CallToolResult> {
  const result = await callTextApi(config, "/llms.txt")
  if (!result.ok) {
    return { isError: true, content: [{ type: "text", text: result.text }] }
  }
  return { content: [{ type: "text", text: result.text }] }
}
