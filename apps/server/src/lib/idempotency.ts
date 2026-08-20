import { and, eq } from "drizzle-orm"
import { idempotencyKeys, type Database } from "@postbag/db"

const TTL_MS = 24 * 60 * 60 * 1_000

export type StoredIdempotentResponse = {
  readonly statusCode: number
  readonly body: unknown
}

export async function lookupIdempotencyKey(
  db: Database,
  organizationId: string,
  key: string,
): Promise<StoredIdempotentResponse | null> {
  const [row] = await db
    .select({ statusCode: idempotencyKeys.statusCode, responseBody: idempotencyKeys.responseBody })
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.organizationId, organizationId), eq(idempotencyKeys.key, key)))
    .limit(1)
  if (row === undefined) return null
  return { statusCode: row.statusCode, body: row.responseBody }
}

export async function storeIdempotencyKey(
  db: Database,
  organizationId: string,
  key: string,
  method: string,
  path: string,
  statusCode: number,
  body: unknown,
): Promise<void> {
  const now = new Date()
  await db
    .insert(idempotencyKeys)
    .values({
      organizationId,
      key,
      method,
      path,
      statusCode,
      responseBody: body,
      createdAt: now,
      expiresAt: new Date(now.getTime() + TTL_MS),
    })
    .onConflictDoNothing()
}
