import { validateAgainstSchema } from "@postbag/core"

export type JsonSchemaProperty = Readonly<Record<string, unknown>>
export type JsonSchemaRoot = Readonly<Record<string, unknown>>
export type EditableMappingRule = {
  readonly from?: string
  readonly const?: unknown
  readonly default?: unknown
  readonly expr?: string
}

export type ParsedConstant =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string }

const mappingSchemaContextKey = "__postbag_mapping_stream_schema"

function matchesType(value: unknown, type: string): boolean {
  if (type === "null") return value === null
  if (type === "array") return Array.isArray(value)
  if (type === "object") return typeof value === "object" && value !== null && !Array.isArray(value)
  if (type === "integer") return typeof value === "number" && Number.isInteger(value)
  return typeof value === type
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1")
}

function rebaseLocalReferences(value: unknown, prefix: string): unknown {
  if (Array.isArray(value)) return value.map((item) => rebaseLocalReferences(item, prefix))
  if (typeof value !== "object" || value === null) return value

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => {
      // The copied root is an internal subschema, so its original resource identifier must
      // not change where its local references start resolving.
      if (key === "$id") return []
      if ((key === "$ref" || key === "$dynamicRef") && typeof nested === "string") {
        if (nested === "#") return [[key, prefix]]
        if (nested.startsWith("#/")) return [[key, `${prefix}${nested.slice(1)}`]]
      }
      return [[key, rebaseLocalReferences(nested, prefix)]]
    }),
  )
}

function validationSchema(
  property: JsonSchemaProperty,
  root: JsonSchemaRoot | undefined,
  propertyName: string | undefined,
): JsonSchemaRoot {
  if (root !== undefined && propertyName !== undefined) {
    const prefix = `#/$defs/${mappingSchemaContextKey}`
    return {
      $defs: { [mappingSchemaContextKey]: rebaseLocalReferences(root, prefix) },
      $ref: `${prefix}/properties/${escapeJsonPointerSegment(propertyName)}`,
    }
  }

  const schema: Record<string, unknown> = { ...property }
  for (const key of ["$schema", "$defs", "definitions"] as const) {
    if (root?.[key] !== undefined) schema[key] = root[key]
  }
  return schema
}

export function parseMappingConstant(
  raw: string,
  property: JsonSchemaProperty | undefined,
  rootSchema?: JsonSchemaRoot,
  propertyName?: string,
): ParsedConstant {
  const declared = property?.["type"]
  const types = (Array.isArray(declared) ? declared : [declared]).filter(
    (value): value is string => typeof value === "string",
  )
  let parsed: unknown
  if (types.length === 1 && types[0] === "string") {
    parsed = raw
  } else {
    try {
      parsed = JSON.parse(raw)
    } catch {
      if (types.length === 0 || types.includes("string")) parsed = raw
      else return { ok: false, message: `Enter a valid ${types.join(" or ")} value.` }
    }
  }

  if (types.length > 0 && !types.some((type) => matchesType(parsed, type))) {
    return { ok: false, message: `Enter a valid ${types.join(" or ")} value.` }
  }

  if (property !== undefined) {
    let result
    try {
      result = validateAgainstSchema(parsed, validationSchema(property, rootSchema, propertyName))
    } catch {
      return { ok: false, message: "This field's Schema could not be resolved." }
    }
    if (!result.valid) {
      const first = result.problems[0]
      return { ok: false, message: first?.message ?? "Enter a value allowed by this field's Schema." }
    }
  }
  return { ok: true, value: parsed }
}

export function formatMappingConstant(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined) return ""
  return JSON.stringify(value)
}

export function initialMappingConstant(property: JsonSchemaProperty | undefined): string {
  const declared = property?.["type"]
  const declaredTypes = Array.isArray(declared)
    ? declared.filter((value): value is string => typeof value === "string")
    : []
  const type = declaredTypes.length > 0 ? declaredTypes.find((value) => value !== "null") ?? declaredTypes[0] : declared
  if (type === "boolean") return "false"
  if (type === "object") return "{}"
  if (type === "array") return "[]"
  if (type === "null") return "null"
  return ""
}

export function mappingRuleWithSource(rule: EditableMappingRule | undefined, from: string): EditableMappingRule {
  return {
    ...Object.fromEntries(Object.entries(rule ?? {}).filter(([key]) => key !== "const" && key !== "expr")),
    from,
  }
}

export function mappingRuleWithConstant(rule: EditableMappingRule | undefined, value: unknown): EditableMappingRule {
  return {
    ...Object.fromEntries(Object.entries(rule ?? {}).filter(([key]) => key !== "from" && key !== "expr")),
    const: value,
  }
}

export function isMappingSourcePathValid(path: string | undefined): boolean {
  return path === undefined || path.trim().length > 0
}
