import type { GeneratedOperation, JsonSchema } from "./types.js"

export interface ParamBinding {
  readonly kind: "path" | "query"
  readonly realName: string
}

export type BodyMode = "none" | "properties" | "whole"

/**
 * How a tool's flat input object maps back onto an operation's path params, query params
 * and JSON body. Body fields keep their original names; a param whose name collides with a
 * body field (or another param) is exposed as `path_<name>`/`query_<name>` instead — see
 * `docs/AGENT-NATIVE.md` §6 and the Phase 3 spec.
 */
export interface OperationBinding {
  readonly properties: Record<string, JsonSchema>
  readonly required: readonly string[]
  readonly paramBindings: ReadonlyMap<string, ParamBinding>
  readonly bodyMode: BodyMode
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asJsonSchema(value: unknown): JsonSchema {
  return isRecord(value) ? value : {}
}

export function buildOperationBinding(operation: GeneratedOperation): OperationBinding {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  const used = new Set<string>()
  let bodyMode: BodyMode = "none"

  if (operation.body !== null) {
    const bodyProperties = operation.body["properties"]
    if (isRecord(bodyProperties)) {
      bodyMode = "properties"
      for (const [name, schema] of Object.entries(bodyProperties)) {
        properties[name] = asJsonSchema(schema)
        used.add(name)
      }
      const bodyRequired = operation.body["required"]
      if (Array.isArray(bodyRequired)) {
        for (const name of bodyRequired) {
          if (typeof name === "string") required.push(name)
        }
      }
    } else {
      bodyMode = "whole"
      properties["body"] = operation.body
      used.add("body")
      required.push("body")
    }
  }

  const paramBindings = new Map<string, ParamBinding>()
  for (const param of operation.params) {
    let propName = param.name
    if (used.has(propName)) propName = `${param.in}_${param.name}`
    while (used.has(propName)) propName = `_${propName}`
    used.add(propName)

    const schema: JsonSchema =
      param.description !== undefined && param.schema["description"] === undefined
        ? { ...param.schema, description: param.description }
        : param.schema
    properties[propName] = schema
    if (param.required) required.push(propName)
    paramBindings.set(propName, { kind: param.in, realName: param.name })
  }

  return { properties, required, paramBindings, bodyMode }
}

export function bindingToInputSchema(binding: OperationBinding): JsonSchema {
  return {
    type: "object",
    properties: binding.properties,
    ...(binding.required.length > 0 ? { required: binding.required } : {}),
  }
}
