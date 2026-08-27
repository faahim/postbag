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

function matchesType(value: unknown, type: string): boolean {
  if (type === "null") return value === null
  if (type === "array") return Array.isArray(value)
  if (type === "object") return typeof value === "object" && value !== null && !Array.isArray(value)
  if (type === "integer") return typeof value === "number" && Number.isInteger(value)
  return typeof value === type
}

function validationSchema(property: JsonSchemaProperty, root: JsonSchemaRoot | undefined): JsonSchemaRoot {
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
    const result = validateAgainstSchema(parsed, validationSchema(property, rootSchema))
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
