export type JsonSchemaProperty = Readonly<Record<string, unknown>>
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

export function parseMappingConstant(raw: string, property: JsonSchemaProperty | undefined): ParsedConstant {
  const declared = property?.["type"]
  const types = (Array.isArray(declared) ? declared : [declared]).filter(
    (value): value is string => typeof value === "string",
  )
  if (types.length === 0 || (types.length === 1 && types[0] === "string")) {
    return { ok: true, value: raw }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    if (types.includes("string")) return { ok: true, value: raw }
    return { ok: false, message: `Enter a valid ${types.join(" or ")} value.` }
  }

  if (!types.some((type) => matchesType(parsed, type))) {
    return { ok: false, message: `Enter a valid ${types.join(" or ")} value.` }
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
