/**
 * Shared shapes for the generated operation catalogue (`src/generated/operations.json`).
 * Kept dependency-free so `scripts/generate.ts` can `import type` these without any
 * runtime resolution (Node's `--experimental-strip-types` erases `import type`
 * statements entirely, so the script never actually loads this module at runtime).
 */

/** A JSON Schema fragment, already fully dereferenced (no `$ref`). */
export type JsonSchema = Record<string, unknown>

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete"

export interface OperationParam {
  readonly name: string
  readonly in: "path" | "query"
  readonly required: boolean
  readonly schema: JsonSchema
  readonly description?: string
}

export interface GeneratedOperation {
  readonly operationId: string
  readonly method: HttpMethod
  readonly path: string
  readonly summary?: string
  readonly description?: string
  readonly tags?: readonly string[]
  readonly params: readonly OperationParam[]
  readonly body: JsonSchema | null
}
