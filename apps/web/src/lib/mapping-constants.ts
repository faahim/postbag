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

type SchemaResource = { readonly id?: string; readonly pointer: string }
type SchemaResourceMap = {
  readonly pointers: ReadonlyMap<string, string>
  readonly anchors: ReadonlyMap<string, string>
}

function resourceKey(resource: SchemaResource): string {
  return resource.id ?? resource.pointer
}

function splitReference(reference: string): { readonly id: string; readonly fragment: string } {
  const fragmentStart = reference.indexOf("#")
  if (fragmentStart === -1) return { id: reference, fragment: "" }
  return { id: reference.slice(0, fragmentStart), fragment: reference.slice(fragmentStart) }
}

function resolveResourceId(id: string, base: string | undefined): string {
  const resourceId = splitReference(id).id
  if (base === undefined) return resourceId
  try {
    return new URL(resourceId, base).href
  } catch {
    return resourceId
  }
}

function nextResource(value: Record<string, unknown>, pointer: string, parent: SchemaResource): SchemaResource {
  const declaredId = value["$id"]
  if (typeof declaredId !== "string") return parent
  return { id: resolveResourceId(declaredId, parent.id), pointer }
}

function collectSchemaResources(
  value: unknown,
  pointer: string,
  parent: SchemaResource,
  pointers: Map<string, string>,
  anchors: Map<string, string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectSchemaResources(item, `${pointer}/${index}`, parent, pointers, anchors)
    })
    return
  }
  if (!isRecord(value)) return

  const resource = nextResource(value, pointer, parent)
  if (resource.id !== undefined) pointers.set(resource.id, resource.pointer)
  for (const key of ["$anchor", "$dynamicAnchor"] as const) {
    const anchor = value[key]
    if (typeof anchor === "string") anchors.set(`${resourceKey(resource)}#${anchor}`, pointer)
  }

  for (const [key, nested] of Object.entries(value)) {
    collectSchemaResources(nested, `${pointer}/${escapeJsonPointerSegment(key)}`, resource, pointers, anchors)
  }
}

function referencePointer(
  reference: string,
  current: SchemaResource,
  resources: SchemaResourceMap,
): string {
  const { id, fragment } = splitReference(reference)
  const targetId = id === "" ? current.id : resolveResourceId(id, current.id)
  const pointer = targetId === undefined ? current.pointer : resources.pointers.get(targetId)
  if (pointer === undefined) return reference
  if (fragment === "" || fragment === "#") return pointer
  if (fragment.startsWith("#/")) return `${pointer}${fragment.slice(1)}`
  return resources.anchors.get(`${targetId ?? resourceKey(current)}${fragment}`) ?? reference
}

function rewriteBundledReferences(
  value: unknown,
  pointer: string,
  parent: SchemaResource,
  resources: SchemaResourceMap,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => rewriteBundledReferences(item, `${pointer}/${index}`, parent, resources))
  }
  if (!isRecord(value)) return value

  const resource = nextResource(value, pointer, parent)
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => {
      if (key === "$id") return []
      if ((key === "$ref" || key === "$dynamicRef") && typeof nested === "string") {
        return [[key, referencePointer(nested, resource, resources)]]
      }
      return [[key, rewriteBundledReferences(nested, `${pointer}/${escapeJsonPointerSegment(key)}`, resource, resources)]]
    }),
  )
}

function bundledSchema(root: JsonSchemaRoot, prefix: string): unknown {
  const pointers = new Map<string, string>()
  const anchors = new Map<string, string>()
  const rootResource: SchemaResource = { pointer: prefix }
  collectSchemaResources(root, prefix, rootResource, pointers, anchors)
  return rewriteBundledReferences(root, prefix, rootResource, { pointers, anchors })
}

function validationSchema(
  property: JsonSchemaProperty,
  root: JsonSchemaRoot | undefined,
  propertyName: string | undefined,
): JsonSchemaRoot {
  if (root !== undefined && propertyName !== undefined) {
    const prefix = `#/$defs/${mappingSchemaContextKey}`
    return {
      $defs: { [mappingSchemaContextKey]: bundledSchema(root, prefix) },
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
    let jsonValue: unknown
    try {
      jsonValue = JSON.parse(raw)
    } catch {
      const rawValidation = validateMappingValue(raw, property, rootSchema, propertyName)
      if (rawValidation.valid) return { ok: true, value: raw }
      return { ok: false, message: rawValidation.message }
    }

    const jsonValidation = validateMappingValue(jsonValue, property, rootSchema, propertyName)
    if (jsonValidation.valid) return { ok: true, value: jsonValue }
    if (jsonValidation.schemaError) return { ok: false, message: jsonValidation.message }

    const rawValidation = validateMappingValue(raw, property, rootSchema, propertyName)
    if (rawValidation.valid) return { ok: true, value: raw }
    if (rawValidation.schemaError) return { ok: false, message: rawValidation.message }
    return { ok: false, message: jsonValidation.message }
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
