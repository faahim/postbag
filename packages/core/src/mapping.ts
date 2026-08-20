import { ExpressionsNotEnabled } from "./errors.js"
import { validateAgainstSchema, type JsonSchema } from "./schema.js"

export type MappingEntry = {
  readonly from?: string
  readonly const?: unknown
  readonly expr?: string
  readonly default?: unknown
}
export type Mapping = Readonly<Record<string, MappingEntry>>
export type MappingResult = {
  readonly payload: Readonly<Record<string, unknown>>
  readonly extras: Readonly<Record<string, unknown>>
  readonly problems: readonly string[]
}
export type MappingValidation = {
  readonly status: "valid" | "incomplete"
  readonly missing: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function atPath(data: Readonly<Record<string, unknown>>, path: string): unknown {
  let current: unknown = data
  for (const segment of path.split(".")) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

function requiredFields(schema: JsonSchema): readonly string[] {
  const required = schema["required"]
  return Array.isArray(required)
    ? required.filter((item): item is string => typeof item === "string").sort()
    : []
}

function schemaHasPath(schema: JsonSchema, path: string): boolean {
  let current: unknown = schema
  for (const segment of path.split(".")) {
    if (!isRecord(current) || !isRecord(current["properties"])) return false
    current = current["properties"][segment]
  }
  return isRecord(current)
}

function hasOwn(entry: MappingEntry, key: keyof MappingEntry): boolean {
  return Object.prototype.hasOwnProperty.call(entry, key)
}

export function applyMapping(
  data: Readonly<Record<string, unknown>>,
  mapping: Mapping,
  streamSchema: JsonSchema,
): MappingResult {
  const payload: Record<string, unknown> = {}
  const mappedRoots = new Set<string>()

  for (const [target, entry] of Object.entries(mapping)) {
    if (entry.expr !== undefined) throw new ExpressionsNotEnabled()
    if (entry.from !== undefined) {
      const value = atPath(data, entry.from)
      payload[target] =
        value === undefined || value === null || value === "" ? entry.default : value
      const root = entry.from.split(".")[0]
      if (root !== undefined) mappedRoots.add(root)
    } else if (hasOwn(entry, "const")) {
      payload[target] = entry.const
    } else if (hasOwn(entry, "default")) {
      payload[target] = entry.default
    }
  }

  const extras = Object.fromEntries(
    Object.entries(data).filter(([field]) => !mappedRoots.has(field)),
  )
  const validation = validateAgainstSchema(payload, streamSchema)
  return {
    payload,
    extras,
    problems: validation.problems.map(
      (item) => `${item.path === "" ? "$" : item.path}: ${item.message}`,
    ),
  }
}

export function validateMapping(
  mapping: Mapping,
  streamSchema: JsonSchema,
  formSchema?: JsonSchema,
): MappingValidation {
  const missing = requiredFields(streamSchema).filter((field) => {
    const entry = mapping[field]
    if (entry === undefined || entry.expr !== undefined) return true
    if (entry.from === undefined) return !hasOwn(entry, "const") && !hasOwn(entry, "default")
    if (formSchema === undefined || schemaHasPath(formSchema, entry.from)) return false
    return !hasOwn(entry, "default")
  })
  return { status: missing.length === 0 ? "valid" : "incomplete", missing }
}
