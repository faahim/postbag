import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { generateOpenapiDocument, generateOpenapiYaml } from "./lib/generateOpenapiDoc.js"

const OPENAPI_YAML_PATH = fileURLToPath(new URL("../../../api/openapi.yaml", import.meta.url))

type OperationObject = { readonly operationId?: string; readonly security?: readonly unknown[] }
type OpenapiDoc = {
  readonly paths: Readonly<Record<string, Readonly<Record<string, OperationObject>>>>
  readonly components?: { readonly securitySchemes?: Readonly<Record<string, unknown>> }
}

function allOperations(doc: OpenapiDoc): { readonly path: string; readonly method: string; readonly op: OperationObject }[] {
  const operations: { path: string; method: string; op: OperationObject }[] = []
  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      operations.push({ path, method, op })
    }
  }
  return operations
}

describe("generated OpenAPI document", () => {
  it("keeps api/openapi.yaml in sync with the Zod route definitions (run `pnpm openapi:export` if this fails)", async () => {
    const generatedYaml = await generateOpenapiYaml()
    const committedYaml = await readFile(OPENAPI_YAML_PATH, "utf8")
    expect(generatedYaml).toBe(committedYaml)
  })

  it("gives every operation a unique, well-formed operationId — 59+ operations", async () => {
    const doc = (await generateOpenapiDocument()) as unknown as OpenapiDoc
    const operations = allOperations(doc)
    expect(operations.length).toBeGreaterThanOrEqual(59)

    for (const { path, method, op } of operations) {
      expect(op.operationId, `${method.toUpperCase()} ${path} is missing an operationId`).toBeDefined()
      expect(op.operationId ?? "").toMatch(/^[a-z][a-z0-9_]*$/)
    }

    const ids = operations.map(({ op }) => op.operationId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("registers bearerAuth and requires it on /v1/* while /health stays public", async () => {
    const doc = (await generateOpenapiDocument()) as unknown as OpenapiDoc
    expect(doc.components?.securitySchemes?.["bearerAuth"]).toBeDefined()

    const health = allOperations(doc).find(({ path }) => path === "/health")
    expect(health?.op.security).toEqual([])

    // GET /v1/auth/providers is deliberately public (job G 1c) — the SPA calls it before
    // sign-in even loads, so it carries its own `security: []` override instead of
    // inheriting the document default. Every other /v1/* operation still inherits it.
    const v1Operations = allOperations(doc).filter(({ path }) => path.startsWith("/v1/") && path !== "/v1/auth/providers")
    expect(v1Operations.length).toBeGreaterThan(0)
    for (const { path, method, op } of v1Operations) {
      // No per-operation override — they inherit the document-level `security: [{ bearerAuth: [] }]`.
      expect(op.security, `${method.toUpperCase()} ${path} should inherit the document security default`).toBeUndefined()
    }
  })

  it("GET /v1/auth/providers is public (operationId auth_providers, security: [])", async () => {
    const doc = (await generateOpenapiDocument()) as unknown as OpenapiDoc
    const op = doc.paths["/v1/auth/providers"]?.["get"]
    expect(op?.operationId).toBe("auth_providers")
    expect(op?.security).toEqual([])
  })
})
