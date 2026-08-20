export type Cursor = { readonly createdAt: Date; readonly id: string }

export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify([cursor.createdAt.toISOString(), cursor.id])
  return Buffer.from(json, "utf8").toString("base64url")
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
    if (!Array.isArray(decoded) || decoded.length !== 2) return null
    const parts = decoded as unknown[]
    const iso: unknown = parts[0]
    const id: unknown = parts[1]
    if (typeof iso !== "string" || typeof id !== "string") return null
    const createdAt = new Date(iso)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

export function parseLimit(raw: number | undefined, fallback = 50, max = 200): number {
  if (raw === undefined || !Number.isFinite(raw) || raw < 1) return fallback
  return Math.min(Math.floor(raw), max)
}

/**
 * Given `limit + 1` rows fetched in (created_at desc, id desc) order, split off the
 * page and compute the opaque cursor for the next page, if any.
 */
export function page<Row extends { readonly createdAt: Date; readonly id: string }>(
  rows: readonly Row[],
  limit: number,
): { readonly data: readonly Row[]; readonly nextCursor: string | null } {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const last = data.at(-1)
  const nextCursor = hasMore && last !== undefined ? encodeCursor(last) : null
  return { data, nextCursor }
}
