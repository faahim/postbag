/** The shape of `{ error }` from the API's `ErrorEnvelope` schema. */
export type ApiError = {
  readonly code: string
  readonly message: string
  readonly hint?: string
  readonly docs?: string
  readonly details?: Record<string, unknown>
}

/** Minimal, injectable stdout/stderr so commands are testable without spying on `console`. */
export type Io = {
  readonly log: (line: string) => void
  readonly error: (line: string) => void
}

export const consoleIo: Io = {
  log: (line) => {
    console.log(line)
  },
  error: (line) => {
    console.error(line)
  },
}

/** JSON by default when stdout is not a TTY or `--json` was passed; compact tables on a TTY. */
export function shouldUseJson(jsonFlag: boolean | undefined, stdoutIsTty: boolean): boolean {
  return jsonFlag === true || !stdoutIsTty
}

/** Prints a success payload: raw JSON in agent mode, a compact table/summary on a human TTY. */
export function printData(io: Io, data: unknown, json: boolean): void {
  if (json) {
    io.log(JSON.stringify(data, null, 2))
    return
  }
  if (data === undefined) return
  if (Array.isArray(data)) {
    io.log(renderTable(data))
    return
  }
  if (isPlainObject(data)) {
    io.log(renderItem(data))
    return
  }
  io.log(formatCell(data))
}

/** Prints an API/CLI error to stderr and returns the process exit code (always `1`). */
export function printError(io: Io, error: ApiError, json: boolean): number {
  if (json) {
    io.error(JSON.stringify({ error }, null, 2))
    return 1
  }
  io.error(`${error.code}: ${error.message}`)
  if (error.hint !== undefined) io.error(`hint: ${error.hint}`)
  if (error.docs !== undefined) io.error(`docs: ${error.docs}`)
  return 1
}

/** Renders one object as aligned `key: value` lines, `id` first. */
function renderItem(item: Record<string, unknown>): string {
  const keys = orderKeysIdFirst(Object.keys(item))
  const width = keys.reduce((max, key) => Math.max(max, key.length), 0)
  return keys.map((key) => `${key.padEnd(width)}  ${formatCell(item[key])}`).join("\n")
}

const MAX_CELL = 48

/**
 * Hand-rolled table: header + rows, columns from the union of row keys, `id` first.
 * Human mode is a glance, not a dump: columns whose values are all objects/arrays (settings,
 * counts, nested resources) are hidden, long cells are truncated, and a trailing note says
 * what was left out — `--json` always has everything.
 */
function renderTable(rows: readonly unknown[]): string {
  if (rows.length === 0) return "(empty)"
  const objectRows = rows.filter(isPlainObject)
  if (objectRows.length !== rows.length) {
    return rows.map((row) => formatCell(row)).join("\n")
  }

  const keySet = new Set<string>()
  for (const row of objectRows) {
    for (const key of Object.keys(row)) keySet.add(key)
  }
  const allColumns = orderKeysIdFirst([...keySet])
  const isScalarColumn = (column: string): boolean =>
    objectRows.some((row) => row[column] !== undefined && row[column] !== null) &&
    objectRows.every((row) => !isPlainObject(row[column]) && !Array.isArray(row[column]))
  const columns = allColumns.filter(isScalarColumn)
  const hidden = allColumns.filter((column) => !columns.includes(column))

  const cells = objectRows.map((row) => columns.map((column) => truncate(formatCell(row[column]))))
  const widths = columns.map((column, index) =>
    cells.reduce((max, row) => Math.max(max, (row[index] ?? "").length), column.length),
  )

  const renderRow = (values: readonly string[]): string =>
    values.map((value, index) => value.padEnd(widths[index] ?? value.length)).join("  ").trimEnd()

  const lines = [renderRow(columns), ...cells.map((row) => renderRow(row))]
  if (hidden.length > 0) lines.push(`(${hidden.join(", ")} hidden — use --json for everything)`)
  return lines.join("\n")
}

function truncate(value: string): string {
  return value.length > MAX_CELL ? `${value.slice(0, MAX_CELL - 1)}…` : value
}

function orderKeysIdFirst(keys: readonly string[]): string[] {
  const idKeys = keys.filter((key) => key === "id" || key.endsWith("_id"))
  const rest = keys.filter((key) => !idKeys.includes(key))
  return [...idKeys, ...rest]
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
