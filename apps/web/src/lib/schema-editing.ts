export type EditableFieldType = "string" | "number" | "boolean" | "other"

export type EditableField = {
  readonly name: string
  readonly type: EditableFieldType
  readonly required: boolean
  /** The property as published, so untouched fields round-trip without losing constraints. */
  readonly original?: Readonly<Record<string, unknown>>
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
