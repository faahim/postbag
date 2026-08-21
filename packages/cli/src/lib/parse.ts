/** Splits a `--tags a,b,c`-style flag into a trimmed, non-empty list. */
export function splitList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "")
  return items
}

/** Parses `--data '{json}'` into an object body, throwing a CLI-friendly error on bad JSON. */
export function parseJsonFlag(value: string | undefined): Record<string, unknown> | undefined {
  if (value === undefined) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`--data is not valid JSON: ${reason}`)
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("--data must be a JSON object.")
  }
  return parsed as Record<string, unknown>
}

/** Merges a `--data` object with explicit flag overrides (flags win). Drops `undefined` values. */
export function mergeBody(
  base: Record<string, unknown> | undefined,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(base ?? {}) }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) merged[key] = value
  }
  return merged
}

/** Parses a positive integer flag (e.g. `--limit`), throwing on garbage input. */
export function parseIntFlag(value: string | undefined, flagName: string): number | undefined {
  if (value === undefined) return undefined
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n) || n < 0) throw new Error(`${flagName} must be a non-negative integer.`)
  return n
}
