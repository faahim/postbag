export type EditableFieldType = "string" | "number" | "boolean" | "other"

export type EditableField = {
  readonly name: string
  readonly type: EditableFieldType
  readonly required: boolean
  /** The property as published, so untouched fields round-trip without losing constraints. */
  readonly original?: Readonly<Record<string, unknown>>
}

const EDITABLE_FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/u

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const ROOT_CROSS_FIELD_KEYWORDS = [
  "dependentRequired",
  "dependentSchemas",
  "dependencies",
  "allOf",
  "anyOf",
  "oneOf",
  "if",
  "then",
  "else",
  "not",
  "$ref",
  "$dynamicRef",
] as const

export const UNSAFE_SCHEMA_FIELD_REMOVAL_MESSAGE =
  "This Schema has advanced cross-field constraints. Remove the field through the API so its constraints can be updated together."

function schemaContainsReference(schema: unknown, visited = new Set<object>()): boolean {
  if (!isRecord(schema)) return false
  if (visited.has(schema)) return false
  visited.add(schema)

  if (typeof schema["$ref"] === "string" || typeof schema["$dynamicRef"] === "string") return true

  for (const keyword of ["$defs", "definitions", "properties", "patternProperties", "dependentSchemas"] as const) {
    const schemas = schema[keyword]
    if (isRecord(schemas) && Object.values(schemas).some((value) => schemaContainsReference(value, visited))) return true
  }

  for (const keyword of ["allOf", "anyOf", "oneOf", "prefixItems"] as const) {
    const schemas = schema[keyword]
    if (Array.isArray(schemas) && schemas.some((value) => schemaContainsReference(value, visited))) return true
  }

  const items = schema["items"]
  if (Array.isArray(items)) {
    if (items.some((value) => schemaContainsReference(value, visited))) return true
  } else if (schemaContainsReference(items, visited)) return true

  for (const keyword of [
    "additionalProperties",
    "unevaluatedProperties",
    "propertyNames",
    "contains",
    "additionalItems",
    "unevaluatedItems",
    "not",
    "if",
    "then",
    "else",
    "contentSchema",
  ] as const) {
    if (schemaContainsReference(schema[keyword], visited)) return true
  }

  const dependencies = schema["dependencies"]
  return isRecord(dependencies) && Object.values(dependencies).some(
    (value) => !Array.isArray(value) && schemaContainsReference(value, visited),
  )
}

/**
 * The field-list editor only owns root `properties` and `required`. It must not guess
 * how a published cross-field rule, including a local reference, should change when a
 * property is removed. Call this before removing a field from the dashboard draft.
 */
export function hasUnsafeSchemaFieldRemoval(
  fields: readonly Pick<EditableField, "name">[],
  previous: Readonly<Record<string, unknown>> | undefined,
): boolean {
  if (previous === undefined) return false
  const properties = previous["properties"]
  if (!isRecord(properties)) return false

  const names = new Set(fields.map((field) => field.name))
  const removedNames = new Set(Object.keys(properties).filter((name) => !names.has(name)))
  if (removedNames.size === 0) return false

  return (
    ROOT_CROSS_FIELD_KEYWORDS.some((keyword) => previous[keyword] !== undefined) ||
    Object.entries(properties).some(
      ([name, property]) => names.has(name) && schemaContainsReference(property),
    )
  )
}

/** Dots are reserved for nested paths in Stream mappings, not literal top-level field names. */
export function isEditableFieldName(name: string): boolean {
  return EDITABLE_FIELD_NAME.test(name)
}

export function schemaFieldType(
  property: Readonly<Record<string, unknown>> | undefined,
): EditableFieldType {
  const type = property?.["type"]
  if (type === "string" || type === "number" || type === "boolean") return type
  if (type === "integer") return "number"
  return "other"
}

/** Postgres jsonb does not keep key order, so use the published UI order when available. */
export function editableFieldsFromSchema(
  jsonSchema: Readonly<Record<string, unknown>> | undefined,
  ui: Readonly<Record<string, unknown>> | undefined,
): EditableField[] {
  const properties = (jsonSchema?.["properties"] ?? {}) as Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >
  const required = new Set((jsonSchema?.["required"] as readonly string[] | undefined) ?? [])
  const orderOf = (name: string): number => {
    const order = (ui?.[name] as { order?: unknown } | undefined)?.order
    return typeof order === "number" ? order : Number.MAX_SAFE_INTEGER
  }
  return Object.entries(properties)
    .map(([name, property], index) => ({
      name,
      type: schemaFieldType(property),
      required: required.has(name),
      original: property,
      index,
    }))
    .sort((a, b) => orderOf(a.name) - orderOf(b.name) || a.index - b.index)
    .map(({ name, type, required: isRequired, original }) => ({
      name,
      type,
      required: isRequired,
      original,
    }))
}

/** Replace only the field-editor-owned keywords and retain every other top-level constraint. */
export function buildEditedSchema(
  fields: readonly EditableField[],
  previous: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  if (hasUnsafeSchemaFieldRemoval(fields, previous)) {
    throw new Error(UNSAFE_SCHEMA_FIELD_REMOVAL_MESSAGE)
  }
  const properties = Object.fromEntries(
    fields.map((field) => {
      const keepOriginal =
        field.original !== undefined &&
        (field.type === "other" || schemaFieldType(field.original) === field.type)
      return [field.name, keepOriginal ? field.original : { type: field.type }]
    }),
  )
  return {
    ...previous,
    $schema: previous?.["$schema"] ?? "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties,
    required: fields.filter((field) => field.required).map((field) => field.name),
    additionalProperties: previous?.["additionalProperties"] ?? true,
  }
}

export function retainUiHints(
  ui: Readonly<Record<string, unknown>> | undefined,
  fields: readonly Pick<EditableField, "name">[],
): Record<string, unknown> | undefined {
  if (ui === undefined) return undefined
  const names = new Set(fields.map((field) => field.name))
  return Object.fromEntries(Object.entries(ui).filter(([name]) => names.has(name)))
}

/** Seed a new Stream shape from a Form without flattening published property constraints.
 * Observed fields keep the inferred shape of their recent Submission values; only fields
 * without either source use the minimal string fallback. */
export function schemaFromKnownFields(
  fields: readonly string[],
  published: Readonly<Record<string, unknown>> | undefined,
  observedProperties: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): Record<string, unknown> {
  const properties = (published?.["properties"] ?? {}) as Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >
  return {
    ...published,
    $schema: published?.["$schema"] ?? "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: Object.fromEntries(
      fields.map((name) => [name, properties[name] ?? observedProperties[name] ?? { type: "string" }]),
    ),
    required: published?.["required"] ?? [],
    additionalProperties: published?.["additionalProperties"] ?? true,
  }
}
