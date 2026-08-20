import type { ErrorObject, ValidateFunction } from "ajv"
import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

import { PostbagError } from "./errors.js"

export type JsonSchema = Readonly<Record<string, unknown>>
export type SchemaValidationProblem = {
  readonly path: string
  readonly keyword: string
  readonly message: string
}
export type SchemaValidationResult = {
  readonly valid: boolean
  readonly problems: readonly SchemaValidationProblem[]
}
export type DriftKind = "new_field" | "missing_field" | "type_change"
export type DriftFinding = {
  readonly kind: DriftKind
  readonly field: string
  readonly details: Readonly<Record<string, unknown>>
}
export type UiWidget =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "number"
  | "date"
  | "hidden"
  | "file"
export type UiHint = { readonly order: number; readonly widget: UiWidget; readonly label: string }
export type InferredUiHints = Readonly<Record<string, UiHint>>
export type InferredSchema = { readonly jsonSchema: JsonSchema; readonly ui: InferredUiHints }

const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }))
const compiledSchemas = new Map<string, ValidateFunction>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isRecord(value)) return value
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) sorted[key] = stableValue(value[key])
  return sorted
}

function stableHash(value: unknown): string {
  const text = JSON.stringify(stableValue(value))
  let hash = 2_166_136_261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function hasRemoteReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRemoteReference)
  if (!isRecord(value)) return false
  if (typeof value["$ref"] === "string" && !value["$ref"].startsWith("#")) return true
  return Object.values(value).some(hasRemoteReference)
}

function compileSchema(jsonSchema: JsonSchema): ValidateFunction {
  if (hasRemoteReference(jsonSchema)) {
    throw new PostbagError("validation_failed", "Remote JSON Schema references are not allowed.")
  }
  const key = stableHash(jsonSchema)
  const cached = compiledSchemas.get(key)
  if (cached !== undefined) return cached
  const compiled = ajv.compile(jsonSchema)
  compiledSchemas.set(key, compiled)
  return compiled
}

function problem(error: ErrorObject): SchemaValidationProblem {
  return {
    path: error.instancePath,
    keyword: error.keyword,
    message: error.message ?? "Schema validation failed.",
  }
}

export function validateAgainstSchema(
  data: unknown,
  jsonSchema: JsonSchema,
): SchemaValidationResult {
  const validate = compileSchema(jsonSchema)
  const valid = validate(data)
  return { valid, problems: valid ? [] : (validate.errors ?? []).map(problem) }
}

function valueType(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  if (Number.isInteger(value)) return "integer"
  return typeof value
}

function allowedTypes(schema: Record<string, unknown>): readonly string[] {
  const type = schema["type"]
  if (typeof type === "string") return [type]
  if (Array.isArray(type)) return type.filter((item): item is string => typeof item === "string")
  return []
}

function inspectDrift(
  data: Record<string, unknown>,
  schema: Record<string, unknown>,
  prefix: string,
): readonly DriftFinding[] {
  const properties = isRecord(schema["properties"]) ? schema["properties"] : {}
  const required = Array.isArray(schema["required"])
    ? schema["required"].filter((item): item is string => typeof item === "string")
    : []
  const findings: DriftFinding[] = []

  for (const key of Object.keys(data).sort()) {
    const field = prefix === "" ? key : `${prefix}.${key}`
    const fieldSchema = properties[key]
    if (!isRecord(fieldSchema)) {
      findings.push({ kind: "new_field", field, details: { actual_type: valueType(data[key]) } })
      continue
    }
    const actual = valueType(data[key])
    const expected = allowedTypes(fieldSchema)
    const compatible =
      expected.length === 0 ||
      expected.includes(actual) ||
      (actual === "integer" && expected.includes("number"))
    if (!compatible) {
      findings.push({ kind: "type_change", field, details: { expected, actual } })
      continue
    }
    const nested = data[key]
    if (isRecord(nested)) findings.push(...inspectDrift(nested, fieldSchema, field))
  }

  for (const key of required.sort()) {
    if (data[key] === undefined) {
      const field = prefix === "" ? key : `${prefix}.${key}`
      findings.push({ kind: "missing_field", field, details: {} })
    }
  }
  return findings
}

export function detectDrift(data: unknown, jsonSchema: JsonSchema): readonly DriftFinding[] {
  if (!isRecord(data)) return [{ kind: "type_change", field: "$", details: { expected: "object" } }]
  return inspectDrift(data, jsonSchema, "")
}

function inferredType(values: readonly unknown[]): unknown {
  const types = [...new Set(values.map(valueType))].sort()
  if (types.length === 1) return types[0]
  return types
}

function schemaFor(values: readonly unknown[]): JsonSchema {
  const type = inferredType(values)
  if (type === "object" && values.every(isRecord)) return inferSchema(values).jsonSchema
  if (type === "array") {
    const items: unknown[] = values.flatMap((value): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []))
    return items.length === 0 ? { type: "array" } : { type: "array", items: schemaFor(items) }
  }
  return { type }
}

function labelFor(field: string): string {
  const words = field.replaceAll(/[_-]+/gu, " ").trim()
  return words.length === 0 ? field : (words[0] ?? "").toUpperCase() + words.slice(1)
}

function widgetFor(field: string, values: readonly unknown[]): UiWidget {
  const name = field.toLowerCase()
  const strings = values.filter((value): value is string => typeof value === "string")
  if (values.every((value) => typeof value === "boolean")) return "checkbox"
  if (values.every((value) => typeof value === "number")) return "number"
  if (name.includes("email") || strings.some((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)))
    return "email"
  if (/phone|tel|mobile/u.test(name)) return "tel"
  if (/url|website|site/u.test(name) || strings.some((value) => /^https?:\/\//u.test(value)))
    return "text"
  if (
    /date|birthday|dob/u.test(name) ||
    (strings.length > 0 && strings.every((value) => /^\d{4}-\d{2}-\d{2}$/u.test(value)))
  )
    return "date"
  if (/message|description|comment|body/u.test(name) || strings.some((value) => value.length > 120))
    return "textarea"
  return "text"
}

export function inferSchema(samples: readonly Record<string, unknown>[]): InferredSchema {
  const canonicalSamples = [...samples].sort((left, right) =>
    JSON.stringify(stableValue(left)).localeCompare(JSON.stringify(stableValue(right))),
  )
  const fields = [...new Set(canonicalSamples.flatMap((sample) => Object.keys(sample)))].sort()
  const properties: Record<string, JsonSchema> = {}
  const ui: Record<string, UiHint> = {}
  const required: string[] = []

  for (const [order, field] of fields.entries()) {
    const values = canonicalSamples.flatMap((sample) =>
      sample[field] === undefined ? [] : [sample[field]],
    )
    properties[field] = schemaFor(values)
    ui[field] = { order, widget: widgetFor(field, values), label: labelFor(field) }
    if (canonicalSamples.length > 0 && values.length === canonicalSamples.length)
      required.push(field)
  }
  return {
    jsonSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties,
      required,
      additionalProperties: true,
    },
    ui,
  }
}
