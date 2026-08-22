import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { generateOpenapiDocument, generateOpenapiYaml } from "./lib/generateOpenapiDoc.js"

const OPENAPI_YAML_PATH = fileURLToPath(new URL("../../../api/openapi.yaml", import.meta.url))

type ParameterObject = {
  readonly in?: string
  readonly name?: string
  readonly required?: boolean
}
type OperationObject = {
  readonly operationId?: string
  readonly security?: readonly unknown[]
  readonly tags?: readonly string[]
  readonly parameters?: readonly ParameterObject[]
  readonly responses?: Readonly<Record<string, unknown>>
}
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

    // GET /v1/auth/providers (job G 1c), the two agent-onboarding endpoints
    // /v1/auth/request-code + /v1/auth/verify-code (job H 1b), and GET
    // /v1/invitations/{id} (job L — the accept-invitation page must render before sign-in)
    // are deliberately public — they carry their own `security: []` override instead of
    // inheriting the document default. Every other /v1/* operation still inherits it,
    // including DELETE /v1/invitations/{id} (revoke), which shares a path with the public
    // GET, so this is keyed by (path, method), not path alone.
    const PUBLIC_V1_OPERATIONS = new Set([
      "get /v1/auth/providers",
      "post /v1/auth/request-code",
      "post /v1/auth/verify-code",
      "get /v1/invitations/{id}",
      "post /v1/billing/webhook",
    ])
    const v1Operations = allOperations(doc).filter(
      ({ path, method }) => path.startsWith("/v1/") && !PUBLIC_V1_OPERATIONS.has(`${method} ${path}`),
    )
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

  it("the two agent-onboarding auth-code endpoints are public with well-formed operationIds", async () => {
    const doc = (await generateOpenapiDocument()) as unknown as OpenapiDoc
    const requestCode = doc.paths["/v1/auth/request-code"]?.["post"]
    expect(requestCode?.operationId).toBe("auth_request_code")
    expect(requestCode?.security).toEqual([])

    const verifyCode = doc.paths["/v1/auth/verify-code"]?.["post"]
    expect(verifyCode?.operationId).toBe("auth_verify_code")
    expect(verifyCode?.security).toEqual([])
  })

  it("GET /v1/invitations/{id} is public (operationId invitations_get, security: [])", async () => {
    const doc = (await generateOpenapiDocument()) as unknown as OpenapiDoc
    const op = doc.paths["/v1/invitations/{id}"]?.["get"]
    expect(op?.operationId).toBe("invitations_get")
    expect(op?.security).toEqual([])
  })

  it("POST /v1/billing/webhook is a public signed provider callback", async () => {
    const doc = (await generateOpenapiDocument()) as unknown as OpenapiDoc
    const op = doc.paths["/v1/billing/webhook"]?.["post"]
    expect(op?.operationId).toBe("billing_webhook")
    expect(op?.tags).toContain("billing")
    expect(op?.security).toEqual([])
    expect(op?.responses?.["202"]).toBeDefined()

    const requiredHeaders = (op?.parameters ?? [])
      .filter((parameter) => parameter.in === "header" && parameter.required === true)
      .map((parameter) => parameter.name)
    expect(requiredHeaders).toEqual(
      expect.arrayContaining(["webhook-id", "webhook-timestamp", "webhook-signature"]),
    )
  })
})
