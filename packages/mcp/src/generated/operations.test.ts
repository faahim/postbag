import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { generateOperationsJson } from "../../scripts/generate.js"

const OPERATIONS_JSON_PATH = fileURLToPath(new URL("./operations.json", import.meta.url))

describe("generated operation catalogue", () => {
  it("keeps src/generated/operations.json in sync with api/openapi.yaml (run `pnpm generate` if this fails)", async () => {
    const { json } = await generateOperationsJson()
    const committed = await readFile(OPERATIONS_JSON_PATH, "utf8")
    expect(json).toBe(committed)
  })

  it("has 59+ operations, each with a unique, well-formed operationId", async () => {
    const { json } = await generateOperationsJson()
    const operations = JSON.parse(json) as { readonly operationId: string }[]

    expect(operations.length).toBeGreaterThanOrEqual(59)
    for (const operation of operations) {
      expect(operation.operationId).toMatch(/^[a-z][a-z0-9_]*$/)
    }
    const ids = operations.map((operation) => operation.operationId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
