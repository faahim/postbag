import { PayloadTooLarge } from "./errors.js"

export const CONTROL_FIELDS = ["_redirect", "_gotcha", "_idempotency", "_subject", "_test"] as const

export type ControlField = (typeof CONTROL_FIELDS)[number]
export type NormalizedBody = {
  readonly data: Readonly<Record<string, unknown>>
  readonly control: Partial<Readonly<Record<ControlField, unknown>>>
}

const MAX_DEPTH = 12
const MAX_FIELDS = 1_000
const MAX_BYTES = 1_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isControlField(value: string): value is ControlField {
  return CONTROL_FIELDS.some((field) => field === value)
}

function normalizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) throw new PayloadTooLarge("The submission nesting depth is too large.")
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new PayloadTooLarge("Circular submission values are not supported.")
    seen.add(value)
    const normalized = value.map((item) => normalizeValue(item, depth + 1, seen))
    seen.delete(value)
    return normalized
  }
  if (isRecord(value)) {
    if (seen.has(value)) throw new PayloadTooLarge("Circular submission values are not supported.")
    seen.add(value)
    const normalized: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeValue(item, depth + 1, seen)
    }
    seen.delete(value)
    return normalized
  }
  return value
}

function arrayKey(key: string): { readonly base: string; readonly index: number | null } | null {
  const match = /^(.*)\[(\d*)\]$/.exec(key)
  const base = match?.[1]
  const rawIndex = match?.[2]
  if (base === undefined || rawIndex === undefined || base.length === 0) return null
  return { base, index: rawIndex === "" ? null : Number.parseInt(rawIndex, 10) }
}

export function normalizeBody(input: unknown, contentType: string): NormalizedBody {
  if (!isRecord(input)) {
    throw new PayloadTooLarge(`The ${contentType} submission body must be an object.`)
  }
  const entries = Object.entries(input)
  if (entries.length > MAX_FIELDS) throw new PayloadTooLarge("The submission has too many fields.")

  const data: Record<string, unknown> = {}
  const control: Partial<Record<ControlField, unknown>> = {}
  const indexedArrays = new Map<string, Map<number, unknown>>()
  const seen = new WeakSet()

  for (const [key, rawValue] of entries) {
    const value = normalizeValue(rawValue, 1, seen)
    if (isControlField(key)) {
      control[key] = value
      continue
    }
    const parsedKey = arrayKey(key)
    if (parsedKey === null) {
      data[key] = value
      continue
    }
    if (parsedKey.index === null && Array.isArray(value)) {
      data[parsedKey.base] = value
      continue
    }
    const existing = indexedArrays.get(parsedKey.base) ?? new Map<number, unknown>()
    const index = parsedKey.index ?? existing.size
    existing.set(index, value)
    indexedArrays.set(parsedKey.base, existing)
  }

  for (const [key, values] of indexedArrays) {
    data[key] = [...values.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, value]) => value)
  }

  const normalized = { data, control }
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_BYTES) {
    throw new PayloadTooLarge("The normalized submission is larger than one megabyte.")
  }
  return normalized
}
