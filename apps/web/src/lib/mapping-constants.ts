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
type MappingValueValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly schemaError: boolean; readonly message: string }

const mappingSchemaContextKey = "__postbag_mapping_stream_schema"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

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

function rebaseLocalReferences(value: unknown, prefix: string, isRoot = true): unknown {
  if (Array.isArray(value)) return value.map((item) => rebaseLocalReferences(item, prefix, false))
  if (!isRecord(value)) return value

  if (!isRoot && typeof value["$id"] === "string") return value

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => {
      // The copied root is an internal subschema, so its original resource identifier must
      // not change where its local references start resolving.
      if (isRoot && key === "$id") return []
      if ((key === "$ref" || key === "$dynamicRef") && typeof nested === "string") {
        if (nested === "#") return [[key, prefix]]
        if (nested.startsWith("#/")) return [[key, `${prefix}${nested.slice(1)}`]]
      }
      return [[key, rebaseLocalReferences(nested, prefix, false)]]
    }),
  )
}

function validationSchema(
  property: JsonSchemaProperty,
  root: JsonSchemaRoot | undefined,
  propertyName: string | undefined,
): JsonSchemaRoot {
  // A property with its own identifier is already a complete Schema resource. Validate
  // that resource directly so its `#…` references keep their original local boundary.
  if (typeof property["$id"] === "string") {
    return Object.fromEntries(Object.entries(property).filter(([key]) => key !== "$id"))
  }

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

function validateMappingValue(
  value: unknown,
  property: JsonSchemaProperty,
  rootSchema: JsonSchemaRoot | undefined,
  propertyName: string | undefined,
): MappingValueValidation {
  try {
    const result = validateAgainstSchema(value, validationSchema(property, rootSchema, propertyName))
    if (result.valid) return { valid: true }
    return {
      valid: false,
      schemaError: false,
      message: result.problems[0]?.message ?? "Enter a value allowed by this field's Schema.",
    }
  } catch {
    return { valid: false, schemaError: true, message: "This field's Schema could not be resolved." }
  }
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

  if (types.length === 0 && property !== undefined) {
    const rawValidation = validateMappingValue(raw, property, rootSchema, propertyName)
    if (rawValidation.valid) return { ok: true, value: raw }
    if (rawValidation.schemaError) return { ok: false, message: rawValidation.message }
  }

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
    const validation = validateMappingValue(parsed, property, rootSchema, propertyName)
    if (!validation.valid) return { ok: false, message: validation.message }
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
