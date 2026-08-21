import type { Resource, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"

import type { ApiClientOptions } from "./httpClient.js"
import { callJsonApi, callTextApi } from "./httpClient.js"

export const RESOURCES: readonly Resource[] = [
  {
    uri: "postbag://forms",
    name: "Forms",
    description: "Every form in the caller's organization (GET /v1/forms).",
    mimeType: "application/json",
  },
  {
    uri: "postbag://openapi",
    name: "OpenAPI contract",
    description: "The full Postbag API contract (GET /openapi.json) — every operation, schema and error code.",
    mimeType: "application/json",
  },
  {
    uri: "postbag://llms.txt",
    name: "Agent onboarding guide",
    description: "Postbag's llms.txt: what it is, the vocabulary, and the calls that matter (GET /llms.txt).",
    mimeType: "text/markdown",
  },
]

export const RESOURCE_TEMPLATES: readonly ResourceTemplate[] = [
  {
    uriTemplate: "postbag://forms/{formId}",
    name: "Form",
    description: "A single form's configuration (GET /v1/forms/{formId}).",
    mimeType: "application/json",
  },
  {
    uriTemplate: "postbag://forms/{formId}/schema",
    name: "Form schema",
    description: "The current published schema version for a form (GET /v1/forms/{formId}/schema).",
    mimeType: "application/json",
  },
  {
    uriTemplate: "postbag://streams/{streamId}/schema",
    name: "Stream schema",
    description: "The current published schema version for a stream (GET /v1/streams/{streamId}/schema).",
    mimeType: "application/json",
  },
]

interface ResourceContent {
  readonly uri: string
  readonly mimeType: string
  readonly text: string
}

async function readJson(config: ApiClientOptions, uri: string, path: string): Promise<ResourceContent> {
  const result = await callJsonApi(config, "GET", path, undefined)
  if (!result.ok) {
    throw new McpError(ErrorCode.InternalError, `${path} returned HTTP ${String(result.status)}`, result.body)
  }
  return { uri, mimeType: "application/json", text: JSON.stringify(result.body, null, 2) }
}

const FORM_PATTERN = /^postbag:\/\/forms\/([^/]+)$/
const FORM_SCHEMA_PATTERN = /^postbag:\/\/forms\/([^/]+)\/schema$/
const STREAM_SCHEMA_PATTERN = /^postbag:\/\/streams\/([^/]+)\/schema$/

export async function readResource(config: ApiClientOptions, uri: string): Promise<ResourceContent> {
  if (uri === "postbag://forms") return readJson(config, uri, "/v1/forms")
  if (uri === "postbag://openapi") return readJson(config, uri, "/openapi.json")
  if (uri === "postbag://llms.txt") {
    const result = await callTextApi(config, "/llms.txt")
    if (!result.ok) {
      throw new McpError(ErrorCode.InternalError, `/llms.txt returned HTTP ${String(result.status)}`)
    }
    return { uri, mimeType: "text/markdown", text: result.text }
  }

  const formMatch = FORM_PATTERN.exec(uri)
  if (formMatch?.[1] !== undefined) return readJson(config, uri, `/v1/forms/${formMatch[1]}`)

  const formSchemaMatch = FORM_SCHEMA_PATTERN.exec(uri)
  if (formSchemaMatch?.[1] !== undefined) return readJson(config, uri, `/v1/forms/${formSchemaMatch[1]}/schema`)

  const streamSchemaMatch = STREAM_SCHEMA_PATTERN.exec(uri)
  if (streamSchemaMatch?.[1] !== undefined) return readJson(config, uri, `/v1/streams/${streamSchemaMatch[1]}/schema`)

  throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`)
}
