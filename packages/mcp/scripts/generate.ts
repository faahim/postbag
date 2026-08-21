// Regenerates `src/generated/operations.json` from `../../api/openapi.yaml` (the generated
// contract — see `apps/server/scripts/export-openapi.ts`). Run with `pnpm generate`
// (`node --experimental-strip-types scripts/generate.ts`); the output is committed so the
// published `@postbag/mcp` package is self-contained and never reads the monorepo at runtime.
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { parse } from "yaml"

import type { GeneratedOperation, HttpMethod, JsonSchema, OperationParam } from "../src/types.js"

const HTTP_METHODS: readonly HttpMethod[] = ["get", "post", "put", "patch", "delete"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected an object at ${context}`)
  }
  return value
}

/** Resolves `#/components/schemas/Name`-style pointers against the full document. */
function resolvePointer(pointer: string, doc: Record<string, unknown>): unknown {
  if (!pointer.startsWith("#/")) {
    throw new Error(`Only local $refs are supported, got: ${pointer}`)
  }
  const segments = pointer.slice(2).split("/")
  let node: unknown = doc
  for (const segment of segments) {
    const record = requireRecord(node, `$ref ${pointer}`)
    node = record[segment]
  }
  return node
}

/** Recursively replaces every `$ref` with the schema it points to. Guards against cycles. */
function dereference(node: unknown, doc: Record<string, unknown>, seen: ReadonlySet<string>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => dereference(item, doc, seen))
  }
  if (isRecord(node)) {
    const ref = node["$ref"]
    if (typeof ref === "string") {
      if (seen.has(ref)) return {}
      const resolved = resolvePointer(ref, doc)
      return dereference(resolved, doc, new Set([...seen, ref]))
    }
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      result[key] = dereference(value, doc, seen)
    }
    return result
  }
  return node
}

function dereferenceSchema(node: unknown, doc: Record<string, unknown>): JsonSchema {
  return requireRecord(dereference(node, doc, new Set()), "dereferenced schema")
}

function buildParams(op: Record<string, unknown>, doc: Record<string, unknown>, context: string): OperationParam[] {
  const raw = op["parameters"]
  if (!Array.isArray(raw)) return []

  const params: OperationParam[] = []
  for (const rawParam of raw) {
    const param = requireRecord(rawParam, `${context} parameters`)
    const name = param["name"]
    const location = param["in"]
    if (typeof name !== "string") {
      throw new Error(`Parameter without a name at ${context}`)
    }
    if (location !== "path" && location !== "query") {
      // header/cookie params aren't part of the tool surface.
      continue
    }
    const schema = dereferenceSchema(param["schema"] ?? {}, doc)
    const description = typeof param["description"] === "string" ? param["description"] : undefined
    params.push({
      name,
      in: location,
      required: param["required"] === true,
      schema,
      ...(description !== undefined ? { description } : {}),
    })
  }
  return params
}

function buildBody(op: Record<string, unknown>, doc: Record<string, unknown>, context: string): JsonSchema | null {
  const requestBody = op["requestBody"]
  if (!isRecord(requestBody)) return null
  const content = requireRecord(requestBody["content"], `${context} requestBody.content`)
  const jsonContent = content["application/json"]
  if (!isRecord(jsonContent)) return null
  const schema = jsonContent["schema"]
  if (schema === undefined) return null
  return dereferenceSchema(schema, doc)
}

/** Pure builder: OpenAPI document (already `yaml.parse`d) -> the flat operation catalogue. */
export function buildOperations(rawDoc: unknown): GeneratedOperation[] {
  const doc = requireRecord(rawDoc, "root")
  const paths = requireRecord(doc["paths"], "paths")
  const operations: GeneratedOperation[] = []

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = requireRecord(rawPathItem, `paths.${path}`)
    for (const method of HTTP_METHODS) {
      const rawOp = pathItem[method]
      if (rawOp === undefined) continue
      const context = `${method.toUpperCase()} ${path}`
      const op = requireRecord(rawOp, context)
      const operationId = op["operationId"]
      if (typeof operationId !== "string" || operationId.length === 0) {
        throw new Error(`${context} is missing an operationId`)
      }
      const summary = typeof op["summary"] === "string" ? op["summary"] : undefined
      const description = typeof op["description"] === "string" ? op["description"] : undefined
      const rawTags = op["tags"]
      const tags = Array.isArray(rawTags) ? rawTags.filter((tag): tag is string => typeof tag === "string") : undefined

      operations.push({
        operationId,
        method,
        path,
        ...(summary !== undefined ? { summary } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(tags !== undefined && tags.length > 0 ? { tags } : {}),
        params: buildParams(op, doc, context),
        body: buildBody(op, doc, context),
      })
    }
  }

  return operations
}

function specPath(): string {
  return fileURLToPath(new URL("../../../api/openapi.yaml", import.meta.url))
}

function outputPath(): string {
  return fileURLToPath(new URL("../src/generated/operations.json", import.meta.url))
}

/** The exact contents `pnpm generate` writes to `src/generated/operations.json`. */
export async function generateOperationsJson(): Promise<{ readonly json: string; readonly count: number }> {
  const yamlText = await readFile(specPath(), "utf8")
  const doc: unknown = parse(yamlText)
  const operations = buildOperations(doc)
  return { json: `${JSON.stringify(operations, null, 2)}\n`, count: operations.length }
}

async function main(): Promise<void> {
  const { json, count } = await generateOperationsJson()
  await writeFile(outputPath(), json, "utf8")
  console.log(`Wrote ${outputPath()} (${count.toString()} operations)`)
}

const isMain = fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
